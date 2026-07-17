'use strict';

const Table = require('.');
const {Domain} = require('.').models;
const {getCert, setCert, deleteCert} = require('./cert');
const ModelPs = require('../utils/model_pubsub');

const tldExtract = require('tld-extract').parse_host;
const LetsEncrypt = require('../utils/letsencrypt');
const conf = require('@simpleworkjs/conf');

const letsEncrypt = new LetsEncrypt({
	directoryUrl: conf.environment === "production" ?
		LetsEncrypt.AcmeClient.directory.letsencrypt.production :
		LetsEncrypt.AcmeClient.directory.letsencrypt.staging,
});

class Host extends Table{
	static _key = 'host';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},

		// min 1 so wildcard patterns like "**" / "*" are allowed (see
		// utils/hostname_validate.js; format is enforced at the route layer).
		'host': {isRequired: true, type: 'string', min: 1, max: 500},
		'ip': {isRequired: true, type: 'string', min: 3, max: 500},
		'targetPort': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},

		'is_cache': {default: false, isRequired: false, type: 'boolean',},

		// Per-host reverse-proxy controls. Enforced in OpenResty by
		// ops/nginx_conf/hostfeatures.lua, which reads these straight off the
		// Redis hash. Object fields are JSON-encoded by model-redis.
		'ratelimit_enabled': {default: false, isRequired: false, type: 'boolean',},
		'ratelimit_rate': {default: 10, isRequired: false, type: 'number', min: 1, max: 1000000},
		'ratelimit_burst': {default: 20, isRequired: false, type: 'number', min: 0, max: 1000000},
		'respcache_enabled': {default: false, isRequired: false, type: 'boolean',},
		'hsts_enabled': {default: false, isRequired: false, type: 'boolean',},
		// Per-host HTTP basic auth. basicauth_users is {username: base64(sha1(pw))}
		// (hashed at the route layer, see utils/basicauth.js); enforced in
		// ops/nginx_conf/hostfeatures.lua.
		'basicauth_enabled': {default: false, isRequired: false, type: 'boolean',},
		'basicauth_realm': {default: 'Restricted', isRequired: false, type: 'string', min: 1, max: 128},
		'basicauth_users': {default: function(){return {}}, isRequired: false, type: 'object',},
		// Per-host SSO (OIDC via conf.oidc) — enforced by a signed session cookie
		// checked in ops/nginx_conf/hostfeatures.lua. Empty allow-lists mean "any
		// authenticated user". basic auth and SSO are OR'd (either satisfies).
		'sso_enabled': {default: false, isRequired: false, type: 'boolean',},
		'sso_allow_users': {default: function(){return []}, isRequired: false, type: 'object',},
		'sso_allow_groups': {default: function(){return []}, isRequired: false, type: 'object',},
		'req_headers': {default: function(){return {}}, isRequired: false, type: 'object',},
		'resp_headers': {default: function(){return {}}, isRequired: false, type: 'object',},
		'ip_allow': {default: function(){return []}, isRequired: false, type: 'object',},
		'ip_deny': {default: function(){return []}, isRequired: false, type: 'object',},

		'is_wildcard': {default: false, isRequired: false, type: 'boolean',},
		'wildcard_status': {isRequired: false, type: 'string', min: 3, max: 500},
		'wildcard_matchAny': {default: false, isRequired: false, type: 'boolean',},
		'wildcard_parent': {isRequired: false, type: 'string', min: 3, max: 500},
		'wildcard_expires': {isRequired: false, type: 'number'},
		'domain': {model: 'Domain', rel: 'one'},
	}

	static lookUpObj = {};
	static __lookUpIsReady = false;

	static async addCache(host, parentOBJ){
		try{
			parentOBJ = await this.get(parentOBJ.host);

			if(parentOBJ.is_cache){
				return;
			}

			// Give the on-demand cache entry a TTL so it auto-expires instead of
			// living forever. Only the record hash carries the TTL (model-redis
			// reaps the dangling index member on the next read), so OpenResty's
			// direct HGETALL sees a miss once it expires and re-resolves through
			// this lookup path. 0/falsy conf disables expiry.
			let ttl = conf.cacheTTL > 0 ? {ttl: conf.cacheTTL} : undefined;

			await this.create({
				...parentOBJ,
				host: host,
				is_cache: true,
				is_wildcard: false,
				wildcard_parent: parentOBJ.host
			}, ttl);

			await Cached.create({
				host: host,
				parent: parentOBJ.host
			}, ttl);
		}catch(error){
			console.error('add cache error', {...parentOBJ, host, is_cache: true}, error);
			throw error;
		}
	}

	async bustCache(parent){
		try{
			let cached = await Cached.listDetail();
			for(let cache of cached){
				if(cache.parent == parent){
					let host = await Host.get(cache.host);
					await this.remove.apply(host);
					await cache.remove();
				}
			}

		}catch(error){
			console.error('bust cache error', error)
			// throw error;
		}
	}

	// Remove every cached host entry regardless of its parent. Cache entries are
	// the `is_cache` hosts created on demand by addCache() for wildcard subdomain
	// lookups; clearing them forces the next request for each subdomain to be
	// resolved fresh through the lookup tree / host_lookup service.
	static async clearCache(){
		let count = 0;
		try{
			for(let cache of await Cached.listDetail()){
				try{
					let host = await Host.get(cache.host);
					if(host && host.is_cache) await host.remove();
					await cache.remove();
					count++;
				}catch(error){
					console.error('clear cache entry error', cache.host, error);
				}
			}

			await this.buildLookUpObj();
		}catch(error){
			console.error('clear cache error', error);
			throw error;
		}

		return count;
	}

	static async create(data, ...args){
		try{
			// Validate requested host is valid host and domain
			if(data.challengeType === 'DNS-01-wildcard'){
				await this.validateWildcardCreate(data, args);
				data.is_wildcard = true;
				data.wildcard_status = "Starting"
			}

			// Validate requested host has a valid wildcard parent
			if(data.challengeType === 'wildcardChild'){
				let parentHost = await this.lookUp(data.host);
				if(parentHost.is_wildcard){
					data.wildcard_parent = parentHost.host;
				}else{
					throw new Error(`No parent wild card for ${data.host}`);
				}
			}
			// Create the new host entry
			let out = await super.create(data, ...args);

			// Update the lookup table to reflect new host
			await this.buildLookUpObj();

			// Fire the request for the wild card cert
			// This is "back ground" job, await is intentionally missing
			if(data.challengeType === 'DNS-01-wildcard') out.createWildcardCert();

			return out;

		} catch(error){
			throw error;
		}
	}

	static async validateWildcardCreate(data, ...args){
		console.log('validateWildcardCreate here')
		try{
			if(!data.host.startsWith('*.')) throw new Error('not wild card');
			await Domain.get(data.host);
		}catch(error){
			console.log('validateWildcardCreate error', error)
			if(error.status === 404) error.message = "No matching DNS provider registered"
			throw new this.errors.ObjectValidateError([{key: 'host', message: error.message}]);
		}
	}

	async createWildcardCert(){
		console.log('createWildcardCert', this.domain)
		if(!this.host.startsWith('*.')) throw new Error('not wild card');

		try{
			let host = this;

			await host.update({
				wildcard_status: 'Requesting',
			});
			let cert = await letsEncrypt.dnsWildcard(this.host, {
				challengeCreateFn: async (authz, challenge, keyAuthorization) => {
					await host.update({
						wildcard_status: `Adding record`
					});
					try{
						let parts = tldExtract(authz.identifier.value);

						let res = await host.domain.createRecord(
							{
								type:'TXT',
								name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''}`,
								data: `${keyAuthorization}`
							},
							true // Force the record creation, even if the record exists
						);
					}catch(error){
						console.log('model Host challengeCreateFn error:', error)
						await host.update({
							wildcard_status: `Add DNS record failed`
						});
					}
				},
				onDnsCheck: async(authz, checkCount)=>{
					await host.update({
						wildcard_status: `${checkCount} Checking DNS`
					});
				},
				onDnsCheckFail: async(authz, error)=>{
					await host.update({
						wildcard_status: `DNS check failed for ${authz.identifier.value}`
					});
				},
				onDnsCheckFound: async(authz)=>{
					await host.update({
						wildcard_status: `DNS check found`
					});
				},
				onDnsCheckSuccess: async(authz)=>{
					await host.update({
						wildcard_status: `DNS check success`
					})
				},
				onDnsCheckRemove: async(authz)=>{
					await host.update({
						wildcard_status: `DNS remove record`
					})
				},
				challengeRemoveFn: async (authz, challenge, keyAuthorization)=>{
					await host.update({
						wildcard_status: `DNS remove record`
					})
					try{
						let parts = tldExtract(authz.identifier.value);
						await host.domain.deleteRecords(
							{
								type:'TXT',
								name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''
							}`,
							content: `${keyAuthorization}`}
						);

					}catch(error){
						await host.update({
							wildcard_status: `DNS remove record failed for ${authz.identifier.value}`
						})
					}
				},
			});

			let toAdd = {
				cert_pem: cert.cert.split('\n\n')[0],
				fullchain_pem: cert.cert,
				privkey_pem: cert.key.toString(),
				csr_pem: cert.csr.toString(),
				expiry: 4120307657,
				real_expiry: +LetsEncrypt.AcmeClient.crypto.readCertificateInfo(cert.cert).notAfter/1000,
			}


			await this.constructor.redisClient.SET(`${this.host}:latest`, JSON.stringify(toAdd));
			await this.update({
				wildcard_status: `Done`,
				wildcard_expires: toAdd.real_expiry*1000,
			});

			return this;
		}catch(error){
			console.log('le failed', error)
			this.update({
				wildcard_status: `LE failed`
			});
		}
	}

	async checkWildcardForRenew(){
		try{
			if(this.is_wildcard && Date.now() > this.wildcard_expires - (30 * 24 * 60 * 60 * 1000)){
				this.createWildcardCert();
			}
		}catch(error){
			console.error('checkWildcardForRenew instance', this.host, error)
			throw error;
		}
	}

	static async checkWildcardForRenew(){
		try{
			for(let host of await this.listDetail()){
				host.checkWildcardForRenew();
			}
		}catch(error){
			console.error('checkWildcardForRenew', error)
			throw error;
		}
	}

	async update(data, ...args){
		try{
			// Mirror Host.create()'s challengeType handling (lines above) so an
			// existing HTTP-01 host can be attached to a parent wildcard's cert
			// after creation -- previously this was silently dropped since only
			// create() understood challengeType, leaving no way to convert an
			// existing host onto a wildcard once one was issued.
			if(data && data.challengeType === 'wildcardChild'){
				// Not Host.lookUp() -- this.host already has its own leaf in the
				// tree (it already exists), so a plain lookUp() would just find
				// itself. lookUpWildcardParent() checks the sibling "*" slot
				// instead. See its comment for why create()'s own wildcardChild
				// branch doesn't need this (a host being newly created hasn't
				// claimed its own leaf yet, so plain lookUp() already falls
				// through to the wildcard correctly there).
				let parentHost = Host.lookUpWildcardParent(this.host);
				if(parentHost && parentHost.is_wildcard){
					data.wildcard_parent = parentHost.host;
				}else{
					throw new Error(`No parent wild card for ${this.host}`);
				}
			}

			// Real hostname rename. model-redis's own update() (see super.update()
			// below) already handles the Redis primary-key RENAME + collision
			// check, and Host.buildLookUpObj() below already rebuilds the lookup
			// tree afterward -- but the cert cache (models/cert.js, `${host}:latest`)
			// is a separate record keyed by hostname string that the generic field
			// system doesn't know about, so it doesn't move on its own. Only
			// wildcard hosts (createWildcardCert) ever populate this key -- for a
			// plain HTTP-01 host this is a no-op (nothing to migrate; auto-ssl
			// transparently issues a fresh cert under the new name on first
			// access, same as it does for any newly-created host).
			let oldHost = this.host;
			let renaming = data && typeof data.host === 'string' && data.host !== oldHost;
			if(renaming){
				let cert = await getCert(oldHost);
				if(cert && Object.keys(cert).length) await setCert(data.host, cert);
			}

			let out = await super.update(data, ...args)
			await this.bustCache(this.host);
			await Host.buildLookUpObj();

			if(renaming){
				await deleteCert(oldHost);

				// Work around a model-redis bug (as of ^1.5.0): super.update()'s
				// field-application loop iterates _keyMap's definition order and
				// only reassigns this[_key] (this.host) to the NEW value once it
				// reaches the `host` field itself -- but `updated_on` (always:
				// true, so always included) is defined BEFORE `host` in _keyMap,
				// so it gets HSET while this.host is still the OLD name. Redis's
				// HSET on a non-existent key (the old hash, just RENAMEd away)
				// silently recreates it -- leaving a stray, incomplete hash under
				// the old hostname that makes Host.exists(oldHost) wrongly return
				// true forever, blocking that name from ever being reused.
				await this.constructor.redisClient.DEL(`${conf.redis.prefix || ''}Host_${oldHost}`);
			}

			return out;
		} catch(error){
			throw error;
		}
	}

	async remove(...args){
		try{
			let out = await super.remove(...args);
			await Host.buildLookUpObj();
			await this.bustCache(this.host);
			await deleteCert(this.domain);

			return out;
		} catch(error){
			throw error;
		}
	}

	static async buildLookUpObj(){
		/*
		Build a look up tree for domain records in the redis back end to allow
		complex looks with wildcards.
		*/

		// Build into a fresh, local tree instead of mutating the live one.
		// buildLookUpObj is async (it awaits a redis get() per host) and runs on
		// every host create/update/remove. If we wiped and repopulated the live
		// this.lookUpObj in place, any concurrent lookUp() — which is called
		// synchronously by the host_lookup service and never waits for readiness —
		// would resolve against a half-built tree and randomly miss defined hosts.
		// We only swap the completed tree in at the very end, so lookUp() always
		// sees a complete tree (either the previous one or the new one).
		let lookUpObj = {};

		try{

			// Loop over all the hosts in the redis.
			for(let host of await this.list()){

				// Spit the hosts on "." into its fragments .
				let fragments = host.split('.');

				// Hold a pointer to the root of the lookup tree.
				let pointer = lookUpObj;

				// Walk over each fragment, popping from right to left. 
				while(fragments.length){
					let fragment = fragments.pop();

					// Add a branch to the lookup at the current position
					if(!pointer[fragment]){
						pointer[fragment] = {};
					}

					// Add the record(leaf) when we hit the a full host name.
					// #record denotes a leaf node on this tree.
					if(fragments.length === 0){
						pointer[fragment]['#record'] = await this.get(host)

						// A single-level wildcard's issued cert also covers its own
						// base domain (createWildcardCert requests altNames:
						// [domain, *.domain] -- see utils/letsencrypt.js), but the
						// base domain sits one level ABOVE the wildcard's own leaf
						// in this tree (e.g. "*.cool.mysite.com" is a child of the
						// node for "cool.mysite.com"). Without this, looking up the
						// bare base domain when it has no host of its own falls
						// through to nothing, even though the already-issued cert
						// covers it. `pointer` here is still that parent node
						// (reassigned to the child only below) -- stamp it too, but
						// only if a real, explicitly-created host at that exact
						// name hasn't already claimed this leaf (order-independent:
						// this only ever fills a gap -- a real host's own pass
						// through this loop always overwrites #record
						// unconditionally when it's finalized, see above).
						if(fragment === '*' && !pointer['#record']){
							pointer['#record'] = pointer[fragment]['#record'];
						}
					}

					// Advance the pointer to the next level of the tree.
					pointer = pointer[fragment];
				}
			}

			// Atomically publish the completed tree and mark lookUp ready.
			this.lookUpObj = lookUpObj;
			this.__lookUpIsReady = true;

		}catch(error){
			console.error(error);
		}
	}

	static lookUp(host){
		/*
		Perform a complex lookup of @host on the look up tree.
		*/


		// Hold a pointer to the root of the look up tree
		let place = this.lookUpObj;

		// Hold the last passed long wild card.
		let last_resort = {};

		// Hold the parent element
		let parent = undefined;

		// Walk over each fragment of the host, from right to left
		for(let fragment of host.split('.').reverse()){
			parent = place;

			// If a long wild card is found on this level, hold on to it
			if(place['**']) last_resort = place['**'];

			// If we have a match for the current fragment, update the current pointer
			// A match in the lookup tree takes priority being a more exact match.
			if({...last_resort, ...place}[fragment]){
				place = {...last_resort, ...place}[fragment];

			// If we have a not exact fragment match, a wild card will do.
			}else if(place['*']){
				place = place['*']

			// If no fragment can be matched, continue with the long wild card branch.
			}else if(last_resort){
				place = last_resort;
			}
		}

		// After the tree has been traversed, see if we have leaf node to return. 
		if(place && place['#record']) return place['#record'];

		// If the parent has a wild, its the wildcard we want.
		if(parent && parent['*'] && parent['*']['#record']) return parent['*']['#record'];
	}

	// Find the wildcard covering @host as its own base domain (e.g.
	// "*.cool.mysite.com" for host="cool.mysite.com"), regardless of whether
	// @host is already registered as its own host. Unlike lookUp(), which
	// walks to and returns @host's own exact-match leaf when one exists, this
	// walks to that exact position and looks one level deeper at its "*"
	// child -- the sibling wildcard slot -- so it still finds the parent
	// wildcard even when @host already has its own (non-wildcard) record.
	// Used when attaching an already-created host to a wildcard after the
	// fact (see update() below); Host.create()'s own wildcardChild handling
	// can keep using plain lookUp() since a host being newly created hasn't
	// claimed its own leaf yet.
	static lookUpWildcardParent(host){
		let place = this.lookUpObj;
		for(let fragment of host.split('.').reverse()){
			if(!place[fragment]) return undefined;
			place = place[fragment];
		}
		if(place['*'] && place['*']['#record']) return place['*']['#record'];
	}

	static async lookUpReady(){
		/*
		Wait for the lookup tree to be built.
		*/

		// Check every 5ms to see if the look up tree is ready
		while(!this.__lookUpIsReady) await new Promise(r => setTimeout(r, 5));
		
		return true;
	}
}
Host.register(ModelPs(Host))


class Cached extends Table{
	static _key = 'host';
	static _keyMap = {
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'parent': {isRequired: true, type: 'string', min: 3, max: 500},
	}
}

(async function(){
	await Host.buildLookUpObj();
})();

module.exports = {Host: ModelPs(Host)};

if(require.main === module){(async function(){
try{
	await Host.lookUpReady();

	let host = await Host.get('*.new.test.wtf')

	console.log('host', host.domain.provider.api);



	// let res = await Host.create({
	// 	host: '*.test.holycore.quest',
	// 	ip: '192.168.1.47',
	// 	'created_by': 'william',
	// 	'targetPort': 8006,
	// 	'forcessl': false,
	// 	'targetssl': true,
	// 	'is_wildcard': true,
	// })
	// console.log('IIFE res:\n', res)

	// console.log(Host.test(55))
	// console.log(await Host.list())
	// console.log(await Cached.listDetail())
	// console.log('IIFE lookup:', Host.lookUp('bld3324sdf.test.holycore.quest'))



	// console.log(Host.lookUpObj)

	// console.log(await Host.listDetail())

// 	// console.log(Host.lookUpObj['com']['vm42'])

// 	// console.log('test-res', await Host.lookUp('payments.718it.biz'))

// 	let count = 6
// 	console.log(count++, Host.lookUp('payments.718it.biz').host === 'payments.718it.biz')
// 	console.log(count++, Host.lookUp('sd.blah.test.vm42.com') === undefined)
// 	console.log(count++, Host.lookUp('payments.test.com').host === 'payments.**')
// 	console.log(count++, Host.lookUp('test.sample.other.exmaple.com').host === '**.exmaple.com')
// 	console.log(count++, Host.lookUp('stan.test.vm42.com').host === 'stan.test.vm42.com')
// 	console.log(count++, Host.lookUp('test.vm42.com').host === 'test.vm42.com')
// 	console.log(count++, Host.lookUp('blah.test.vm42.com').host === '*.test.vm42.com')
// 	console.log(count++, Host.lookUp('payments.example.com').host === 'payments.**')	
// 	console.log(count++, Host.lookUp('info.wma.users.718it.biz').host === 'info.*.users.718it.biz')
// 	console.log(count++, Host.lookUp('infof.users.718it.biz') === undefined)
// 	console.log(count++, Host.lookUp('blah.biz') === undefined)
// 	console.log(count++, Host.lookUp('test.1.2.718it.net').host === 'test.*.*.718it.net')
// 	console.log(count++, Host.lookUp('test1.exmaple.com').host === 'test1.exmaple.com')
// 	console.log(count++, Host.lookUp('other.exmaple.com').host === '*.exmaple.com')
// 	console.log(count++, Host.lookUp('info.payments.example.com').host === 'info.**')
// 	console.log(count++, Host.lookUp('718it.biz').host === '718it.biz')


}catch(error){
	console.log('IIFE test area error:', error)
}
})()}
