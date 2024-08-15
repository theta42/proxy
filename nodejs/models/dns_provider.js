'use strict';

const crypto = require("crypto");

const conf = require('../conf');
const Table = require('../utils/redis_model');
const ModelPs = require('../utils/model_pubsub');

const tldExtract = require('tld-extract').parse_host;

const providers = {
	Cloudflare: require('./dns_provider/cloudflare'),
	DigitalOcean: require('./dns_provider/digitalocean'),
	PorkBun: require('./dns_provider/porkbun'),
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

	static async get(domain, ...args){
		try{
			domain = tldExtract(domain).domain;
		}catch{}

		let instance = await super.get(domain, ...args);

		return instance;
	}

	static async getByProviderId(id, ...args){
		let domains = await this.listDetail(...args);
		let results = [];
		for(let domain of domains){
			if(domain.dnsProvider_id == id) results.push(domain);
		}

		return results;
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
}

Domain.register(ModelPs(Domain))

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
		let _keyMap = {...this._keyMap, ...Provider._keyMap};

		let cls = ({
			[this.name] : class extends this {
				static _keyMap = _keyMap;
				static Provider = Provider;
			}
		})[this.name];

		Object.assign(cls.prototype, Provider)

		return cls
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
			await instance.updateDomains(domains);

			return instance;
		}catch(error){
			if(error.name === 'UnauthorizedDnsApi'){
				let keys = [];
				console.log('Provider', Provider)
				for(let key in Provider._keyMap){
					keys.push({'key': key, message: 'Invalid Key'})
				}
				throw this.errors.ObjectValidateError(keys, "API rejected key");
			}
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
				displayName: providers[provider].displayName || provider,
				displayIconUni: providers[provider].displayIconUni || '&#x3f;',
				displayIconHtml:  providers[provider].displayIconHtml || '<i class="fa-solid fa-question"></i>',
				fields: providers[provider]._keyMap,
			});
		}
		return out;
	}

	get api(){
		return new this.constructor.Provider(this);
	}

	async listDomains(){
		return this.api.listDomains()
	}

	async updateDomains(domains){
		domains = domains || await this.listDomains();
		for(let domain of domains){
			if(!(await Domain.exists(domain.domain))){
				await Domain.create({
					created_by: this.created_by,
					domain: domain.domain,
					dnsProvider_id: this.id,
					zoneId: domain.zoneId,
				});
			}
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
	const conf = require('../conf');

	// console.log(await DnsProvider.findall());

	let provider = await DnsProvider.get('e8443e03ac503c7b');

	console.log(await provider.listDomains())

	let domain = await Domain.get('holycore.quest') // pork
	// let domain = await Domain.get('rm-rf.stream') // DO
	// let domain = await Domain.get('test.wtf') // CF

	// console.log(await domain.createRecord({type: 'TXT', name: 'apitewefweefwsewft222', data:'hiiiiiii'}))

	let txtRecords = await domain.getRecords({type: 'TXT'});
	console.log(txtRecords.map(i=>`${i.name}: ${i.data}`))
	// console.log(await domain.deleteRecords({type: 'TXT'}))


}catch(error){
	console.log('IIFE Error:', error);
}finally{
	process.exit(0);
}})()}
