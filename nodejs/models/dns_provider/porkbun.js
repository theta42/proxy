'use strict';

const axios = require('axios');


class PorkBun{
	static _keyMap = {
		'apiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API key'},
		'secretApiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Secret key'},
	}

	baseUrl = 'https://api.porkbun.com/api/json/v3';

	constructor(args){
		this.apiKey = args.apiKey;
		this.secretApiKey = args.secretApiKey;
	}

	async post(url, data){
		let res;
		try{
			data = {
				...(data || {}),
				secretapikey: this.secretApiKey,
				apikey: this.apiKey,
			};
			res = await axios.post(`${this.baseUrl}${url}`, data);

			return res;
		}catch(error){
			throw new Error(`PorkPun API ${error.response.status}: ${error.response.data.message}`)
		}
	}

	__typeCheck(type){
		if(!['A', 'MX', 'CNAME', 'ALIAS', 'TXT', 'NS', 'AAAA', 'SRV', 'TLSA', 'CAA', 'HTTPS', 'SVCB'].includes(type)) throw new Error('PorkBun API: Invalid type passed')
	}

	__parseName(domain, name){
		if(name && !name.endsWith('.'+domain)){
			return `${name}.${domain}`
		}
		return name;
	}

	async getRecords(domain, options){
		let res = await this.post(`/dns/retrieve/${domain}`);
		if(!options) return res.data.records;
		if(options.data) options.content = options.data;

		if(options.type) this.__typeCheck(options.type);
		if(options.name) options.name = this.__parseName(domain, options.name);
		let records = [];

		for(let record of res.data.records){
			let matchCount = 0
			for(let option in options){
				if(record[option] === options[option] && ++matchCount === Object.keys(options).length){
					records.push(record)
					break;
				}
			}
		}

		return records;
	}

	async deleteRecordById(domain, id){
		let res = await this.post(`/dns/delete/${domain}/${id}`);
		return res.data;
	}

	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options);
		// console.log('PorkBun.deleteRecords', records)
		for(let record of records){
			await this.deleteRecordById(domain, record.id)
		}
	}

	async createRecord(domain, options){
		this.__typeCheck(options.type);
		if(!options.content) throw new Error('PorkBun API: `content` key is required for this action')
		// if(options.name) options.name = this.__parseName(domain, options.name);
		// console.log('PorkBun.createRecord to send:', domain, options)

		let res = await this.post(`/dns/create/${domain}`, options);
		return res.data;
	}

	async createRecordForce(domain, options){
		let {content, ...removed} = options;
		// console.log('new options', removed)
		let records = await this.getRecords(domain, removed);
		// console.log('createRecordForce', records)
		if(records.length){
			// console.log('calling delete on', records[0].id)
			// process.exit(0)
			await this.deleteRecordById(domain, records[0].id)
		}
		return await this.createRecord(domain, options)
	}

	async listDomains(){
		let res = await this.post(`/domain/listAll`, {"includeLabels": "yes"});
		return res.data.domains;
	}
}

module.exports = PorkBun;


if(require.main === module){(async function(){try{
	const conf = require('../conf');

	// let porkBun = new PorkBun(conf.porkBun.apiKey, conf.porkBun.secretApiKey);

	// console.log(await porkBun.listDomains())

	// console.log(await porkBun.deleteRecordById('holycore.quest', '415509355'))
	// console.log('IIFE', await porkBun.createRecordForce('holycore.quest', {type:'A', name: 'testapi', content: '127.0.0.5'}))
	// console.log('IIFE', await porkBun.getRecords('holycore.quest', {type:'A', name: 'testapi'}))
}catch(error){
	console.log('IIFE Error:', error)
}})()}
