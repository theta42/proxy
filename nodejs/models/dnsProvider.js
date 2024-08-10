'use strict';

const crypto = require("crypto");

const conf = require('../conf');
const Table = require('../utils/redis_model');
const ModelPs = require('../utils/model_pubsub');

const tldExtract = require('tld-extract').parse_host;

const providers = {
	PorkBun: require('./dns_provider/porkbun'),
	DigitalOcean: require('./dns_provider/digitalocean'),
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
	}

	static async get(data, ...args){
		let instance = await super.get(data, ...args);
		// instance.provider = (await DnsProvider.get(instance.dnsProvider_id)).provider;

		return instance;
	}

	static async getByProviderId(id){
		let domains = await this.listDetail();
		let results = [];
		for(let domain of domains){
			if(domain.dnsProvider_id == id) results.push(domain);
		}

		return results;
	}
}

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
	}

	static __intraModel(provider){
		if(!Object.keys(providers).includes(provider)) throw new Error('Invalid DNS provider')
		let Provider = providers[provider];
		let _keyMap = {...this._keyMap, ...Provider._keyMap};

		return ({
			[this.name] : class extends this {
				static _keyMap = _keyMap;
				static Provider = Provider;
			}
		})[this.name];
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

	static async create(data, ...args){
		let __intraModel = this.__intraModel(data.dnsProvider)

		let instance = await super.create.call(__intraModel, data);
		if(!data.noUpdate) instance.updateDomains();
		return instance;
	}

	static async get(data, ...args){
		let instance = await super.get(data);
		let __intraModel = this.__intraModel(instance.dnsProvider)

		instance = await super.get.call(__intraModel, data);
		instance.provider = new __intraModel.Provider(instance);
		// instance.domains = Domain.getByProviderId(this.id);

		return instance;
	}

	async updateDomains(){
		try{
			let domains = await this.provider.listDomains();
			console.log('got domains', domains)
			for(let domain of domains){
				if(!(await Domain.exists(domain.domain))){
					await Domain.create({
						created_by: this.created_by,
						domain: domain.domain,
						dnsProvider_id: this.id
					});
				}
			}
		}catch(error){
			console.error('updateDomains error', error)
		}
	}

	async getDomains(){
		return Domains.getByProviderId(this.id)
	}

	async remove(){
		let id = this.id
		let instance = await super.remove()
		// get all domains for this provider and delete them

		return instance
	}

	toJSON(){
		return {
			...super.toJSON(),
			domains: this.domains,
		}
	}
}

Domain = ModelPs(Domain);
DnsProvider = ModelPs(DnsProvider);

module.exports = {Domain, DnsProvider}

if(require.main === module){(async function(){try{
	const conf = require('../conf');


	// console.log(aw)

}catch(error){
	console.log('IIFE Error:', error)
}})()}
