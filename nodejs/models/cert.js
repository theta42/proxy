'use strict';

const Table = require('.');
let models = require('./').models;
const ModelPs = require('../utils/model_pubsub');
const crypto = require("crypto");

const tldExtract = require('tld-extract').parse_host;
const LetsEncrypt = require('../utils/letsencrypt');
const conf = require('../conf');

const letsEncrypt = new LetsEncrypt({
	directoryUrl: conf.environment === "production" ?
		LetsEncrypt.AcmeClient.directory.letsencrypt.production :
		LetsEncrypt.AcmeClient.directory.letsencrypt.staging,
});


class CertHost extends Table{
	static _key = 'host'
	static _keyMap = {
		host: {isRequired: true, type: 'string', max: 500},
		cert_id: {isRequired: true, type: 'string', max: 500},
		cert: {model: 'Cert', rel:'one', localKey: 'cert_id'},
		dnsProvider: {model: 'DnsProvider', rel: 'one', localKey: 'dnsProvider_id'},
		dnsProvider_id: {type: 'string'},
	}

	static async create(data, ...args){
		let instance = await super.create(data, ...args);
		await this.buildLookUpObj();

		return instance;
	}

	static lookUpObj = {};
	static __lookUpIsReady = false;

	static async buildLookUpObj(){
		/*
		Build a look up tree for domain records in the redis back end to allow
		complex looks with wildcards.
		*/

		// Hold lookUp ready while the look up object is being built.
		this.__lookUpIsReady = false;
		this.lookUpObj = {};


			// Loop over all the hosts in the redis.
			for(let host of await this.list()){
				try{
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
				}catch(error){
					console.error(error);
				}
			}

			// When the look up tree is finished, remove the ready hold.
			this.__lookUpIsReady = true;

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
CertHost.register(CertHost);

// (async function(){
// 	await CertHost.buildLookUpObj();
// })();

class Cert extends Table{
	static _key = 'id';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},

		'id': {type: 'string', default: ()=>crypto.randomBytes(16).toString("hex")},
		'name': {type: 'string', isRequired: true},
		'is_active': {type: 'boolean', default: false},
		'type': {isRequired: true, type: 'string', extends: true},
		'hosts': {model: 'CertHost', rel: 'many', remoteKey: 'cert_id'},
		'expires': {isRequired: false, type: 'number'},

		'has_error': {isRequired: false, type: 'boolean'},
		'status': {isRequired: false, type: 'string', min: 3, max: 500},

		'cert_pem': {isPrivate: true},
		'fullchain_pem': {isPrivate: true},
		'privkey_pem': {isPrivate: true},
	}

	static async getByHost(host){
		try{
			let host = await CertHost.lookUp(host);

			return this.get(host.cert_id);
		}catch{}

		try{

		}catch{}
	}

	static async findall(filterObj, ...args){
		let results = [...(await super.findall(filterObj, ...args))];

		for(let [name, Cls] of Object.entries(this.__extendedModels.type)){
			if(Cls.__orginalMethods.includes('findall')){
				results.push(...(await Cls.findall(filterObj, ...args)))
			}
		}

		return results;
	}

	static parseCert(cert){
		return LetsEncrypt.AcmeClient.crypto.readCertificateInfo(cert);
	}

	static async cleanUp(){
		let countBad = 0
		for(let cert of await this.findall({type:'Auto'})){
			try{
				await models.Host.lookUp(cert.id) || await models.Host.get(cert.id);
			}catch(error){
				console.log('deleting', cert.id)
				await cert.remove();
				countBad++
			}
		}
		return countBad;
	}
}
Cert.register(Cert, ModelPs);

class Auto extends Cert{
	static _keyMap = {
		hosts: {}
	};

	static async get(data, ...args){
		let index = typeof data === 'object' ? data[this._key] : data;

		let cert = JSON.parse(await this.redisClient.GET(`${index}:latest`));
		let parsed = this.parseCert(cert.cert_pem);

		return await this.__buildInstance({
			...cert,
			id: index,
			is_active: true,
			name: 'Auto',
			hosts: [{host: index}],
			type: 'Auto',
			status: 'HTTP auth',
			expires: cert.expiry*1000,
			created_on: +parsed.notBefore,
			updated_on: +parsed.notBefore,
			created_by: 'System',
		});
	}

	static async create(){
		throw new Error('Can not create this type of cert');
	}

	async getOthers(){
		let others = await this.constructor.redisClient.KEYS(`${this.id}:*`);
		return others.filter(i=> !i.endsWith(':latest'));
	}

	async update(){
		throw new Error('Can not update this type of cert');
	}

	async remove(...args){
		console.log('in remove')
		try{
			for(let key of await this.getOthers()){
				await this.constructor.redisClient.DEL(key);
			}

			await this.constructor.redisClient.DEL(`${this.id}:latest`);
		}catch(error){
			console.log('error in remove', error);
		}
	}

	static async findall(filterObj, ...args){
		let results = [];

		for(let key of await this.redisClient.KEYS('*:latest')){
			let item = await this.get(key.split(':')[0])
			if(item.type !== 'Auto') continue;

			if(!filterObj) results.push(item);
			let matchCount = 0;
			for(let option in filterObj){
				if(item[option] === filterObj[option] && ++matchCount === Object.keys(filterObj).length){
					results.push(item);
					break;
				}
			}

			results.push(item)
		}

		return results
	}

}
Cert.extend('type', Auto);

class Manual extends Cert{
}

class WildCard extends Cert{

	async matchHostsToDns(data){
		let errors = [];
		for(let idx in data.host){
			let domain;
			try{
				if(data.host.slice(0,idx).includes(data.host[idx])){
					errors.push({key: `host`, keyIndex: idx, message: 'Please remove duplicate names.'});
					continue;
				}
				domain = await models.Domain.get(data.host[idx]);
			}catch{
				errors.push({key: `host`, keyIndex: idx, message: 'No matching DNS provider.'});
				continue;
			}
			try{
				await this.hostsCreate({
					host: data.host[idx],
					dnsProvider_id: domain.dnsProvider_id,
				});
			}catch(error){
				console.log('add host error', error)
				errors.push({key: `host`, keyIndex: idx, message: 'Used by another cert'});
			}
		}

		if(errors.length) throw this.constructor.errors.ObjectValidateError(errors, '');
	}

	static async create(data, ...args){
		if(!Array.isArray(data.host)) data.host = [data.host];

		let instance = await super.create({
			...data,
			status: 'Started',
		}, ...args);

		try{
			await instance.matchHostsToDns(data);
			await instance.startWildCardRequest();
		}catch(error){
			await instance.remove();
			throw error;
		}

		return instance;
	}

	async renew(data, ...args){
		await this.update({
			updated_by: data.username,
			status: 'Renewing...',
		});

		try{
			await this.startWildCardRequest();
		}catch(error){
			await this.update({
				updated_by: data.username,
				status: 'Renew failed',
			});

			throw error;
		}

		return this;
	}

	startWildCardRequest(){
		return new Promise(async(resolve, reject)=>{
			try{
				await this.createWildcardCert(resolve, reject);
			}catch(error){
				reject(error);
			}
		});
	}

	async getPem(type){
		let types = ['cert_pem', 'fullchain_pem', 'privkey_pem'];
		if(!this.is_active || !types.includes(type)) throw this.constructor.errors.EntryNotFound(this.id);
		let cert = JSON.parse(await this.constructor.redisClient.GET(`${this.id}:latest`));
		return cert[type]
	}

	async createWildcardCert(resolve, reject){
		try{
			let instance = this;
			let cert = await letsEncrypt.dnsWildcard(this.hosts.map(i=>i.host), {
				challengeCreateFn: async (authz, challenge, keyAuthorization) => {
					resolve();
					try{
						let domain = await models.Domain.get(authz.identifier.value);
						let parts = tldExtract(authz.identifier.value);

						await domain.createRecord({
							type:'TXT',
							name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''}`,
							data: `${keyAuthorization}`
						});
					}catch(error){
						await instance.update({
							has_error: true,
							status: `challengeCreateFn: ${error}`,
						});
						console.log('model Host challengeCreateFn error:', error)
					}
				},
				onDnsCheck: async(authz, checkCount)=>{
					await instance.update({
						status: `${checkCount} Checking DNS`
					});
				},
				onDnsCheckFail: async(authz, error)=>{
					await instance.update({
						has_error: true,
						status: `DNS check failed for ${authz.identifier.value}`
					});
				},
				onDnsCheckFound: async(authz)=>{
					resolve();
					// await instance.update({
					// 	status: `DNS check found ${authz.identifier.value}`
					// });
				},
				onDnsCheckSuccess: async(authz)=>{
					await instance.update({
						status: `DNS check success`
					});
				},
				onDnsCheckRemove: async(authz)=>{
					await instance.update({
						status: `DNS remove record ${authz.identifier.value}`
					});
				},
				challengeRemoveFn: async (authz, challenge, keyAuthorization)=>{
					try{
						let domain = await models.Domain.get(authz.identifier.value);
						let parts = tldExtract(authz.identifier.value);

						await domain.deleteRecords({
							type:'TXT',
							name: `_acme-challenge${parts.sub ? `.${parts.sub}` : ''}`,
							data: `${keyAuthorization}`
						});
					}catch(error){
						console.log('challengeRemoveFn Error:', error);
						await instance.update({

							status: `DNS remove record ${authz.identifier.value}`
						});
					}
				},
			});

			resolve();

			let toAdd = {
				cert_pem: cert.cert.split('\n\n')[0],
				fullchain_pem: cert.cert,
				privkey_pem: cert.key.toString(),
				csr_pem: cert.csr.toString(),
				expiry: 4120307657,
				real_expiry: +LetsEncrypt.AcmeClient.crypto.readCertificateInfo(cert.cert).notAfter/1000,
			};

			await this.constructor.redisClient.SET(`${this.id}:latest`, JSON.stringify(toAdd));
			await this.update({
				status: `Done`,
				is_active: true,
				expires: toAdd.real_expiry*1000,
			});

			return this;
		}catch(error){
			console.log('le failed', error)
			reject(error);
			throw error;
			// this.update({
			// 	wildcard_status: `LE failed`
			// });
		}
	}
}
Cert.extend('type', WildCard);

if(require.main === module){(async function(){try{

	let certHosts = await CertHost.findall()
	console.log('CertHost', certHosts)

	console.log(await Cert.cleanUp())

	let certs = await Cert.findall()

	console.log('Certs', certs)

	// for(let cert of certs){
	// 	await cert.remove()
	// }
	// console.log('certs', certs)
	// for(let cert of certs){
	// 	if(cert.real_expiry) console.log(cert)
	// }


	// console.log(await Cert.get('blah.test.cl.vm42.us'))


	// console.log(await certs[0].remove())
	// console.log(LetsEncrypt.AcmeClient.crypto.readCertificateInfo(certs[0].cert_pem))

	// console.log(certs[0].host,  await Host.lookUp(certs[0].host) || await Host.get(certs[0].host))
}catch(error){
	console.log('IIFE Error:', error);
}finally{
	process.exit(0);
}})()}
