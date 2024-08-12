'use strict';

const axios = require('axios');
const {dnsErrors} = require('./common');


class PorkBun{
	static _keyMap = {
		'apiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API key'},
		'secretApiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Secret key'},
	}

	static displayName = 'DigitalOcean';
	static displayIconHtml = `<?xml version="1.0" encoding="utf-8"?>
<svg width="32px" height="32px" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
   <style>
      .st1{fill:#fff}
   </style>
   <g id="Icon">
      <circle cx="512" cy="512" r="512" style="fill:#ef7878"/>
      <g id="Logo">
         <path class="st1" d="M398.3 331.8c-33.2-17.9-70.3-31.9-108.6-40.9-7.7 16.6-11.5 33.2-11.5 52.4 0 28.1 8.9 53.7 24.3 74.1 24.2-35.7 56.2-66.4 95.8-85.6zm323.3 85.6c15.3-20.4 24.3-46 24.3-74.1 0-19.2-3.8-37.1-11.5-52.4-38.3 7.7-75.4 21.7-108.6 40.9 38.3 19.2 71.5 49.9 95.8 85.6zm-152.1 58.8c-7.7 0-14.1 6.4-14.1 14.1 0 2.6 1.3 5.1 2.6 7.7 5.1 7.7 12.8 12.8 21.7 15.3 2.6-5.1 3.8-11.5 3.8-17.9V489c-1.2-7.7-6.3-12.8-14-12.8z"/>
         <path class="st1" d="M503.1 320.3c-126.5 5.1-224.9 112.4-224.9 239v131.6c0 23 19.2 42.2 42.2 42.2 23 0 42.2-19.2 42.2-42.2v-34.5H659v34.5c0 23 19.2 42.2 42.2 42.2 23 0 42.2-19.2 42.2-42.2v-138c1.2-131.6-107.5-237.7-240.3-232.6zm132.8 184c-7.7 12.8-19.2 21.7-33.2 26.8-8.9 17.9-28.1 30.7-49.8 30.7h-6.4c-7.7 0-14.1-6.4-14.1-14.1s6.4-14.1 14.1-14.1c6.4 0 12.8-2.6 17.9-5.1-7.7-3.8-15.3-8.9-20.4-16.6-5.1-6.4-7.7-12.8-7.7-21.7 0-17.9 15.3-33.2 33.2-33.2 11.5 0 20.4 5.1 26.8 14.1 7.7 10.2 12.8 21.7 12.8 35.8v5.1c6.4-2.6 11.5-7.7 15.3-12.8 2.6-3.8 6.4-3.8 10.2-2.6 2.6-1.2 3.9 3.9 1.3 7.7z"/>
      </g>
   </g>
</svg>`
	// '<i class="fa-solid fa-bacon"></i>';
	static displayIconUni =  '&#xf7e5';

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
			if(!error.response) throw error;
			if(error.response.data.message.includes('Invalid API key')){
				throw dnsErrors.unauthorized(this);
			}
			throw dnsErrors.other(this, error.response.status, error.response.data.message)
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
