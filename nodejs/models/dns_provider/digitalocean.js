'use strict';

const axios = require('axios');
const {dnsErrors, DnsApi} = require('./common');

class DigitalOcean extends DnsApi{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Token'},
	}

	static displayName = 'DigitalOcean'
	static displayIconHtml = `
<svg height="100%" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
   <circle cx="512" cy="512" r="512" style="fill:#0080ff"/>
   <path d="m273.8 669.2-.1-63.7h63.7v63.7h76v-98.8h98.8v98.5c105.1-.1 186.2-104.1 146.1-214.6-14.9-40.9-47.6-73.6-88.5-88.4-110.7-40.2-214.7 41.2-214.7 146.3H256c0-167.5 161.8-298 337.4-243.2 76.8 24 137.7 84.9 161.6 161.6C809.9 606.2 679.4 768 511.9 768v-98.8h-98.6v75.9h-75.9v-75.9h-63.6z" style="fill:#fff"/>
</svg>`
	// '<i class="fa-brands fa-digital-ocean"></i>'
	static displayIconUni =  '&#xf391;'

	constructor(token){
		super()
		this.token = token.token || token;
	}

	__typeCheck(type){
		if(!type) return;
		if(!['A', 'MX', 'CNAME', 'ALIAS', 'TXT', 'NS', 'AAAA', 'SRV', 'TLSA', 'CAA', 'HTTPS', 'SVCB'].includes(type)) throw new Error(`${this.constructor.name} API: Invalid 'type' passed`)
	}

	__parseName(domain, name){
		if(name && !name.endsWith('.'+domain)){
			return `${name}.${domain}`
		}
		return name;
	}

	async axios(method, ...args){
		try{
			let a = axios.create({
				baseURL: 'https://api.digitalocean.com/v2/',
				headers: {Authorization: `Bearer ${this.token}`}
			});

			return await a[method](...args);
		}catch(error){
			if(!error.response) throw error;
			if(error.response.data || error.response.data.id === 'Unauthorized'){
				throw dnsErrors.unauthorized(this);
			}
			throw dnsErrors.other(this, error.response.status, error.response.data.message);
		}
	}

	async listDomains(){
		let res = await this.axios('get', '/domains');
		for(let domain of res.data.domains){
			domain.domain = domain.name
		}
		return res.data.domains;
	}

	async getRecords(domain, options={}){
		this.__typeCheck(options.type);
		let res = await this.axios('get', `/domains/${domain}/records`, {params: options})
		let records = [];

		for(let record of res.data.domain_records){
			let matchCount = 0
			for(let key in options){
				if(record[key] === options[key] && ++matchCount === Object.keys(options).length){
					records.push(record)
				}
			}
		}
		return records;
	}

	async createRecord(domain, options){
		this.__typeCheck(options.type);
		if(!options.data) throw new Error(`${this.constructor.name} API: 'data' key is required for this action`)
		if(options.name) options.name = this.__parseName(domain, options.name);

		let res = await this.axios('post', `/domains/${domain}/records`, options);
		return res.data;
	}

	async deleteRecordById(domain, id){
		let res = await this.axios('delete', `/domains/${domain}/records/${id}`);
	}

	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options)
		for(let record of records){
			let res = await this.deleteRecordById(domain, record.id);
		}

		return true;
	}
}

module.exports = DigitalOcean;


if(require.main === module){(async function(){try{
	// const conf = require('../conf');

	// console.log(await digi.listDomains())

	// console.log('make', await digi.createRecord('rm-rf.stream', {name:'_test', data: '890', type: "TXT"}))
	// console.log('delete', await digi.deleteRecords('rm-rf.stream', {type: 'TXT'}))
	// console.log('get', await digi.getRecords('rm-rf.stream', {type:'TXT', data:'890'}))

}catch(error){
	console.log('IIFE Error:', error)
}})()}
