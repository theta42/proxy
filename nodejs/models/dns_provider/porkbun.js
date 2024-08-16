'use strict';

const axios = require('axios');
const {DnsApi} = require('./common');


class PorkBun extends DnsApi{
	static _keyMap = {
		'apiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API key'},
		'secretApiKey': {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Secret key'},
	}

	static displayName = 'PorkBun';
	static displayIconUni =  '&#xf7e5';
	static displayIconHtml = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
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

	constructor(args){
		super()
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
			res = await axios.post(`https://api.porkbun.com/api/json/v3${url}`, data);

			return res;
		}catch(error){
			if(!error.response) throw error;
			if(error.response.data.message.includes('Invalid API key')){
				throw this.errors.unauthorized();
			}
			// console.error('API error:', error)
			throw this.errors.other(error.response.status, error.response.data.message)
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


	/*
	The API and the generic class interface have different opinions of what keys
	hold what data, the __parseOptions and __pastseRes normal the keys to what
	the class expects

	What the the API calls it : What the class wants it as.
	*/

	__apiKeyMap = {
		'content': 'data'
	}

	async getRecords(domain, options){
		let res = await this.post(`/dns/retrieve/${domain}`);
		let records = this.__parseRes(res.data.records)
		if(!options) return records;
		options = this.__parseOptions(options);

		return records.filter((record)=>{
			let matchCount = 0
			for(let key in options){
				if(record[key] === options[key] && ++matchCount === Object.keys(options).length){
					return true;
				}
			}
		});
	}

	async createRecord(domain, options, force){
		if(force){
			await this.deleteRecords(domain, options)
		}

		try{
			options = this.__parseOptions(options, ['type', 'name', 'data']);
			let res = await this.post(`/dns/create/${domain}`, options);

			return res.data.result;
		}catch(error){
			if(error.message && error.message.includes('We were unable to create the DNS record')){
				return (await this.getRecords(domain, options))[0];
			}
		}
	}

	async deleteRecordById(domain, id){
		let res = await this.post(`/dns/delete/${domain.domain}/${id}`);
		return res.data;
	}


	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options);
		for(let record of records){
			await this.deleteRecordById(domain, record.id)
		}
	}


	async listDomains(){
		let res = await this.post(`/domain/listAll`, {"includeLabels": "yes"});
		return res.data.domains;
	}
}

module.exports = PorkBun;
