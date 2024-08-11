'use strict';

const axios = require('axios');
const {dnsErrors} = require('./common');

class DigitalOcean{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Token'},
	}

	static displayName = 'DigitalOcean'
	static displayIconHtml = '<i class="fa-brands fa-digital-ocean"></i>'
	static displayIconUni =  '&#xf391;'

	constructor(token){
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
