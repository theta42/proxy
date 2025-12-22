'use strict';

const crypto = require("crypto");
const tldExtract = require('tld-extract').parse_host;

const conf = require('../../conf');
const Table = require('../');
const ModelPs = require('../../utils/model_pubsub');


class DnsProvider extends Table{
	static _key = 'id';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'id': {default: ()=>crypto.randomBytes(8).toString("hex")},
		'name': {isRequired: true, type: 'string'},
		'domains': {model:'Domain', rel: 'many', remoteKey: 'dnsProvider_id'},
		'dnsProvider': {isRequired: true, type: 'string', extends: true},
	}

	static errors = {
		...super.errors,
		unauthorized: ()=>{
			let error = new Error('UnauthorizedDnsApi');
			error.name = 'UnauthorizedDnsApi';
			error.message = `Unauthorized call to ${this.constructor.name}`;
			error.status = 424;

			return error;
		},
		invalidInput: (keys)=>{
			let error = new Error('InvalidInput');
			error.name = 'InvalidInput';
			error.message = `Required keys missing: ${keys.join(', ')}`;

			return error

		},
		other: (status, message, APIcode)=>{
			let error = new Error('OtherDnsApiError');
			error.name = 'OtherDnsApiError';
			error.message = `DNS API Error ${this.constructor.name}: ${status} ${message}`;
			error.status = 424;
			error.APIcode = APIcode;

			return error;
		},
	}

	static async create(data){
		// // Test if the provided key is valid by trying to get a list of domains
		// // before adding the entry to the DB
		// let api = new this(data);
		// console.log('api', api)
		// let domains = await api.listDomains();

		// Create the entry in the backing DB, add the fetched domains and
		// return the new instance
		let instance =  await super.create(data);
		try{
			await instance.updateDomains();
		}catch(error){
			await instance.remove();
			throw error;
		}

		return instance;
	}

	async updateDomains(domains){
		/*
		Use the remote API to get a list of known domains from the remote
		service, add them to Domain table associated with the current DNS
		provider. Remove any current associated domains not returned by the
		remote API call.
		*/

		domains = domains || await this.listDomains();

		// Hold a list of current domains so when remove any that are not
		// returned by the current API call
		let currentDomains = this.domains.map(domain => domain.domain);

		// Walk the list of domains returned by the API
		for(let domain of domains){
			// Reduce the list of currentDomains known and skip to the next
			// domain
			if(currentDomains.includes(domain.domain)){
				delete currentDomains[currentDomains.indexOf(domain.domain)];
				continue;
			}

			// Add a new Domain entry
			await this.domainsCreate({
				created_by: this.created_by,
				domain: domain.domain,
				zoneId: domain.zoneId,
			});
		}

		// Walk the list of domains left in currentDomains and remove them.
		for(let domain of currentDomains){
			if(!domain) continue;
			domain = await Table.models.Domain.get(domain);
			await domain.remove();
		}
	}

	// async remove(){
	// 	for(let domain of await this.domains){
	// 		await domain.remove();
	// 	}
	// 	let instance = await super.remove();

	// 	return instance;
	// }

	static info(){
		/*
		Parse class info about the current DNS provider into something the front
		end can use.
		*/
		let svgDataUrl = `data:image/svg+xml;charset=utf-8,${
			encodeURIComponent(this.displayIconHtml)
			.replace(/'/g, '%27')
			.replace(/"/g, '%22')
		}`;

		return {
			name: this.name,
			displayName: this.displayName,
			displayIconUni: this.displayIconUni,
			displayIconHtml: svgDataUrl,
			fields: this._keyMap,
		};
	}

	static toJSON(){
		return {
			...this.info(),
			...(this.__isExtended ? {} :super.toJSON()),
		};
	}

	/*
	No instance data should ever be shared, so just give the static level inf 
	*/
	toJSON(){
		return {
			...this.constructor.toJSON(),
			...super.toJSON(),
		};
	}

	/*
	Helper methods for DNS API interactions
	*/

	__typeCheck(type){
		let validDnsRecordTypes = [
			'A', 'MX', 'CNAME', 'ALIAS', 'TXT', 'NS', 'AAAA',
			'SRV', 'TLSA', 'CAA', 'HTTPS', 'SVCB',
		];

		if(!validDnsRecordTypes.includes(type)){
			// change this to throw a validation error
			throw new Error('PorkBun API: Invalid type passed');
		}
	}

	/*
	The API and the generic class interface have different opinions of what keys
	hold what data, the __parseOptions and __pastseRes normal the keys to what
	the class expects

	What the the API calls it : What the class wants it as.
	*/
	__apiKeyMap = {};

	__parseOptions(options, keys){
		if(!options && !keys) return undefined;

		if(keys){
			let missingKeys = []
			for(let key of keys){
				if(!options[key]) missingKeys.push(key)
			}

			if(missingKeys.length) throw this.errors.invalidInput(missingKeys);
		}

		for(let [apiKey, clsKey] of Object.entries(this.__apiKeyMap)){
			if(options[clsKey]){
				options[apiKey] = options[clsKey];
				delete options[clsKey];
			}
		}

		if(options.type) this.__typeCheck(options.type);

		return options;
	}

	__parseRes(data){
		for(let item of data){
			for(let [apiKey, clsKey] of Object.entries(this.__apiKeyMap)){
				if(item[apiKey]){
					item[clsKey] = item[apiKey];
				}
			}
			try{
				item.name = tldExtract(item.name).sub
			}catch{}
		}

		return data;
	}
}

DnsProvider.register(DnsProvider, ModelPs)


require('./cloudflare');
require('./digitalocean');
require('./porkbun');


if(require.main === module){(async function(){try{

	// console.log(await DnsProvider.subMobels['DigitalOcean'].get('fcaaa1f6b8ab405e'))
	// console.log(JSON.stringify(DnsProvider, null, 2));


	let providers = await DnsProvider.findall();

	// console.log(providers)

	console.log(JSON.stringify(providers[0], null, 2))

	// let provider = await DnsProvider.get('cb9b1041bf92f668');

	// await provider.update({dnsProvider: "CloudFlare"})

	// console.log(provider)

	// console.log(await provider.listDomains())

	// let domain = await Domain.get('holycore.quest') // pork
	// let domain = await Domain.get('rm-rf.stream') // DO
	// let domain = await Domain.get('test.wtf') // CF

	// console.log(await domain.createRecord({type: 'TXT', name: 'apitewefweefwsewft222', data:'hiiiiiii'}))

	// let txtRecords = await domain.getRecords({type: 'TXT'});
	// console.log(txtRecords.map(i=>`${i.name}: ${i.data}`))
	// console.log(await domain.deleteRecords({type: 'TXT'}))


}catch(error){
	console.log('IIFE Error:', error);
}finally{
	process.exit(0);
}})()}
