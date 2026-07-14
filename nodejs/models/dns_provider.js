'use strict';

const crypto = require("crypto");

const conf = require('@simpleworkjs/conf');
const Table = require('.');
const ModelPs = require('../utils/model_pubsub');

const tldExtract = require('tld-extract').parse_host;
const {planARecordUpdate} = require('../utils/dns_records');

const providers = {
	Cloudflare: require('./dns_provider/cloudflare'),
	DigitalOcean: require('./dns_provider/digitalocean'),
	PorkBun: require('./dns_provider/porkbun'),
	DuckDns: require('./dns_provider/duckdns'),
};

class Domain extends Table{
	static _key = 'domain';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'domain': {isRequired: true, type: 'string'},
		'dnsProvider_id': {isRequired: true, type: 'string'},
		'provider': {model: 'DnsProvider', rel:'one', localKey: 'dnsProvider_id'},
		'zoneId': {isRequired: false, type: 'string'},
	}

	// Try the exact string first — Domain.create() stores records under the
	// literal domain it's given (see model-redis' Table.create, which HSETs
	// under data[this._key] verbatim), and its own final `this.get(...)` to
	// return the created instance must find that same literal key. Falling
	// straight to tldExtract normalization here breaks that for any domain
	// tldExtract doesn't recognize as a shared/public suffix — e.g. a DuckDNS
	// name like "myhost.duckdns.org" normalizes to "duckdns.org" (tldExtract
	// has no idea duckdns.org is shared across many independent registrants),
	// so create() would always throw EntryNotFound on its own read-back
	// despite the record having just been written successfully.
	// Only fall back to the normalized parent domain if no exact record
	// exists — that's what lets callers look up an arbitrary hostname (e.g.
	// "www.example.com") and find the Domain that governs it (example.com).
	static async get(domain, ...args){
		try{
			return await super.get(domain, ...args);
		}catch(error){
			if(error.name !== 'EntryNotFound') throw error;

			let normalized;
			try{
				normalized = tldExtract(domain).domain;
			}catch{
				throw error;
			}
			if(normalized === domain) throw error;

			return await super.get(normalized, ...args);
		}
	}

	async getRecords(...args){
		return await this.provider.api.getRecords(this, ...args);
	}

	async createRecord(...args){
		return await this.provider.api.createRecord(this, ...args);
	}

	async deleteRecords(...args){
		return await this.provider.api.deleteRecords(this, ...args);
	}

	/**
	 * Provider-agnostic upsert of a single A record to `ip`. Providers'
	 * createRecord is not a reliable cross-provider upsert (CloudFlare returns the
	 * stale record on a duplicate, DigitalOcean duplicates, CloudFlare's
	 * deleteRecords is a no-op), but all three expose getRecords + deleteRecordById,
	 * so reconcile explicitly. `name` is a sub-label or '@' for apex.
	 */
	async upsertARecord(name, ip){
		let sub = (name === '@' || name === '') ? '' : name;
		let aRecords = await this.getRecords({type: 'A'});
		let {deleteIds, create} = planARecordUpdate(aRecords, sub, ip);

		for(let id of deleteIds){
			await this.provider.api.deleteRecordById(this, id);
		}
		if(create){
			await this.createRecord({type: 'A', name: (sub === '' ? '@' : sub), data: ip});
		}

		return {ip, changed: create || deleteIds.length > 0};
	}
}

Domain.register(ModelPs(Domain));

class DnsProvider extends Table{
	static _key = 'id';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'id': {default: ()=>crypto.randomBytes(8).toString("hex")},
		'name': {isRequired: true, type: 'string'},
		'dnsProvider': {isRequired: true, type: 'string'},
		'domains': {model:'Domain', rel: 'many', remoteKey: 'dnsProvider_id'}
	}

	static __intraModel(provider){
		if(!Object.keys(providers).includes(provider)){
			throw new Error('Invalid DNS provider');
		}

		let Provider = providers[provider];
		// Provider._keyMap is spread last, so a provider-defined field with the
		// same name as one of ours (created_by, updated_by, name, dnsProvider,
		// domains, id — see this._keyMap above) silently overwrites it. This bit
		// a DuckDNS field named `domains`: it replaced the `domains` relation
		// (rel: 'many' to Domain), so `this.domains` stopped being an array and
		// `updateDomains()` broke with "this.domains.map is not a function".
		// New providers must avoid these names.
		let _keyMap = {...this._keyMap, ...Provider._keyMap};

		return ({
			[this.name] : class extends this {
				static _keyMap = _keyMap;
				static Provider = Provider;
			}
		})[this.name];
	}

	static async create(data, ...args){
		let Provider;
		try{
			let __intraModel = this.__intraModel(data.dnsProvider);
			Provider = __intraModel.Provider;

			// This is here test if the given API key is valid
			let provider = new __intraModel.Provider(data, ...args);
			let domains = await provider.listDomains();

			let instance = await super.create.call(__intraModel, data, ...args);
			try{
				await instance.updateDomains(domains);
			}catch(updateError){
				// Don't leave a half-created provider behind (e.g. a Domain that
				// collided with a stale/orphaned record from a previous failed
				// attempt — see updateDomains' own comment on zoneId omission for
				// another case this can throw). Re-fetch before removing: `instance`
				// had its `domains` relation resolved by super.create()'s own
				// internal get() BEFORE updateDomains() created any Domain rows, so
				// it's permanently stale (always empty) — removing `instance`
				// directly would delete the provider but silently leave behind
				// whatever domains updateDomains() managed to create before failing,
				// which is exactly the kind of orphan this is meant to prevent.
				try{
					await (await this.get(instance.id)).remove();
				}catch(removeError){
					console.error('DnsProvider create: failed to roll back', instance.id, 'after updateDomains error:', removeError.message);
				}
				throw updateError;
			}

			// Same staleness issue as above: re-fetch so the returned instance
			// (and the API response built from it) reflects the domains
			// updateDomains() actually just created, not the empty snapshot from
			// before it ran.
			return await this.get(instance.id);
		}catch(error){
			if(error.name === 'UnauthorizedDnsApi'){
				let keys = [];
				for(let key in Provider._keyMap){
					keys.push({'key': key, message: 'Invalid Key'})
				}
				throw this.errors.ObjectValidateError(keys, "API rejected key");
			}
			// Don't swallow other failures (e.g. a domain-sync validation error):
			// returning undefined here made the route crash on `item.id` with an
			// opaque message. Surface the real error to the caller instead.
			throw error;
		}
	}

	static async get(data, ...args){
		let instance = await super.get(data, ...args);
		let __intraModel = this.__intraModel(instance.dnsProvider);

		return await super.get.call(__intraModel, data, ...args);
	}

	static listProviders(){
		let out = [];
		for(let provider in providers){
			out.push({
				name: provider,
				fields: providers[provider]._keyMap,
			});
		}
		return out;
	}

	// Re-sync every configured provider's domain list from its API. Mirrors the
	// manual /dns/domain/refresh/:item route (get -> updateDomains) across all
	// providers; used by the host scheduler. Never throws — one bad provider
	// (e.g. a revoked key) must not abort the rest.
	static async refreshAllDomains(){
		let ids;
		try{
			ids = await this.list();
		}catch(error){
			console.error('refreshAllDomains: could not list providers', error.message);
			return;
		}
		for(let id of ids){
			try{
				let provider = await this.get(id);
				await provider.updateDomains();
			}catch(error){
				console.error('refreshAllDomains: provider', id, error.message);
			}
		}
	}

	get api(){
		return new this.constructor.Provider(this);
	}

	async listDomains(){
		return this.api.listDomains();
	}

	async updateDomains(domains){
		domains = domains || await this.listDomains();
		let currentDomains = this.domains.map(domain => domain.domain);


		for(let domain of domains){
			if(currentDomains.includes(domain.domain)){
				delete currentDomains[currentDomains.indexOf(domain.domain)];
				continue;
			}
			await Domain.create({
				created_by: this.created_by,
				domain: domain.domain,
				dnsProvider_id: this.id,
				// Only providers with a zone concept (e.g. Cloudflare) return a
				// zoneId. Porkbun/DigitalOcean don't, and passing an explicit
				// `undefined` trips model-redis' type check ("zoneId is not string
				// type") and aborts the whole sync — so omit it when absent.
				...(domain.zoneId !== undefined ? {zoneId: domain.zoneId} : {}),
			});
		}

		for(let domain of currentDomains){
			if(!domain) continue
			domain = await Domain.get(domain);
			await domain.remove();
		}
	}

	async remove(){
		for(let domain of await this.domains){
			await domain.remove();
		}
		let instance = await super.remove();

		return instance;
	}

	toJSON(){
		return {
			...super.toJSON(),
			...this.constructor.Provider.toJSON()
		};
	}
}

DnsProvider.register(ModelPs(DnsProvider))


if(require.main === module){(async function(){try{
	const conf = require('@simpleworkjs/conf');

	// console.log(await DnsProvider.findall());

	let provider = await DnsProvider.get('84c6613b9464fbe1');

	// console.log(await provider.listDomains())

	let domain = await Domain.get('holycore.quest') // pork
	// let domain = await Domain.get('rm-rf.stream') // DO
	// let domain = await Domain.get('test.wtf') // CF

	console.log(await domain.createRecord({
		type: 'TXT',
		name: 'apitewefweefwsewft222',
		data: 'sdddddddad'
	}));

	let txtRecords = await domain.getRecords();
	console.log(txtRecords.map(i=>`${i.name}: ${i.data}`))
	// console.log(await domain.deleteRecords({type: 'TXT'}))


}catch(error){
	console.log('IIFE Error:', error);
}finally{
	process.exit(0);
}})()}
