'use strict';

const Table = require('.');
const {Domain, Cert} = require('.').models;
const ModelPs = require('../utils/model_pubsub');

const tldExtract = require('tld-extract').parse_host;
const LetsEncrypt = require('../utils/letsencrypt');
const conf = require('../conf');

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
		'host': {isRequired: true, type: 'string', min: 1, max: 500},
		'ip': {isRequired: true, type: 'string', min: 1, max: 500},
		'targetPort': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},
		'is_cache': {default: false, isRequired: false, type: 'boolean',},
		// 'is_wildcard': {default: false, isRequired: false, type: 'boolean',},
		'cert_id': {type: 'string', isRequired: false},
		// 'cert': {model: 'Cert', rel:'one', localKey: 'cert_id'},
		'domain': {model: 'Domain', rel: 'one'},
		'prevent_remove': {type:'boolean', default: false},
	}

	static lookUpObj = {};
	static __lookUpIsReady = false;

	static async addCache(host, parentOBJ){
		try{
			console.log('addCache host:', host, 'parentOBJ host', parentOBJ.host)
			parentOBJ = await this.get(parentOBJ.host);

			if(parentOBJ.is_cache){
				console.log('addCache parentOBJ is chace, skipping')
				return;
			}

			console.log('addCache, corrent parent?', parentOBJ.wildcard_parent || parentOBJ.host)
			console.log('addCache, got parent', parentOBJ)

			await this.create({
				...parentOBJ,
				host: host,
				is_cache: true,
				is_wildcard: false,
				wildcard_parent: parentOBJ.host
			}, true);

			await Cached.create({
				host: host,
				parent: parentOBJ.host
			});
		}catch(error){
			console.error('add cache error', {...parentOBJ, host, is_cache: true}, error)
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

			throw error;
		}
	}

	static async create(data, ...args){
		try{
			if(data.is_wildcard) await this.validateWildcardCreate(data, args);

			let out = await super.create(data, ...args);
			await this.buildLookUpObj();
			if(out.is_wildcard) out.createWildcardCert();

			return out;

		} catch(error){
			throw error;
		}
	}

	static async validateWildcardCreate(data, ...args){
		try{
			if(!data.host.startsWith('*.')) throw new Error('not wild card');
			await Domain.get(data.host);
		}catch(error){
			console.log('validateWildcardCreate error', error)
			if(error.status === 404) error.message = "No matching DNS provider registered"
			throw this.errors.ObjectValidateError([{key: 'host', message: error.message}]);
		}
	}


	async update(...args){
		try{
			let out = await super.update(...args)
			await this.bustCache(this.host);
			await Host.buildLookUpObj();

			return out;
		} catch(error){
			throw error;
		}
	}

	async remove(force, ...args){
		try{
			if(this.prevent_remove && !force){
				// throw error or something here
				return;
			}
			let out = await super.remove(...args);
			await Host.buildLookUpObj();
			await this.bustCache(this.host);

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

		// Hold lookUp ready while the look up object is being built.
		this.__lookUpIsReady = false;
		this.lookUpObj = {};

		try{

			// Loop over all the hosts in the redis.
			for(let host of await this.list()){

				// Spit the hosts on "." into its fragments .
				let fragments = host.split('.');

				// Hold a pointer to the root of the lookup tree.
				let pointer = this.lookUpObj;

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
					}

					// Advance the pointer to the next level of the tree.
					pointer = pointer[fragment];
				}
			}

			// When the look up tree is finished, remove the ready hold.
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

		// Walk over each fragment of the host, from right to left
		for(let fragment of host.split('.').reverse()){

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
Host.register(ModelPs(Host));


class Cached extends Table{
	static _key = 'host';
	static _keyMap = {
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'parent': {isRequired: true, type: 'string', min: 3, max: 500},
	}
}

// (async function(){
// 	await Host.buildLookUpObj();
// })();


if(require.main === module){(async function(){
try{

	// await Host.lookUpReady();
	console.log(JSON.stringify(Host, null, 2))

	// let host = await Host.get('*.new.test.wtf')

	// console.log('host', host.domain.provider.api);



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
