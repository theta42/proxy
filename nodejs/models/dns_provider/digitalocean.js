'use strict';

const axios = require('axios');
const {DnsProvider} = require('../').models;


class DigitalOcean extends DnsProvider{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Token'},
	}

	static displayName = 'DigitalOcean'
	static displayIconUni =  '&#xf391;'
	static displayIconHtml = `
<svg height="100%" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
   <circle cx="512" cy="512" r="512" style="fill:#0080ff"/>
   <path d="m273.8 669.2-.1-63.7h63.7v63.7h76v-98.8h98.8v98.5c105.1-.1 186.2-104.1 146.1-214.6-14.9-40.9-47.6-73.6-88.5-88.4-110.7-40.2-214.7 41.2-214.7 146.3H256c0-167.5 161.8-298 337.4-243.2 76.8 24 137.7 84.9 161.6 161.6C809.9 606.2 679.4 768 511.9 768v-98.8h-98.6v75.9h-75.9v-75.9h-63.6z" style="fill:#fff"/>
</svg>`


	/*
	The API and the generic class interface have different opinions of what keys
	hold what data, the __parseOptions and __pastseRes normal the keys to what
	the class expects

	What the the API calls it : What the class wants it as.
	*/

	__apiKeyMap = {
		'name': 'domain',
	}

	async axios(method, ...args){
		console.log('this', this.constructor)
		try{
			let a = axios.create({
				baseURL: 'https://api.digitalocean.com/v2/',
				headers: {Authorization: `Bearer ${this.token}`}
			});

			return await a[method](...args);
		}catch(error){
			if(!error.response) throw error;
			if(error.response.data && error.response.data.id === 'Unauthorized'){
				throw this.errors.unauthorized();
			}
			throw this.errors.other(error.response.status, error.response.data.message);
		}
	}

	async listDomains(){
		let res = await this.axios('get', '/domains');

		return this.__parseRes(res.data.domains);
	}

	async getRecords(domain, options){
		options = this.__parseOptions(options);
		let res = await this.axios('get', `/domains/${domain.domain}/records`, {params: options})
		let records = this.__parseRes(res.data.domain_records);
		if(!options) return records;

		return records.filter((record)=>{
			let matchCount = 0
			for(let key in options){
				if(record[key] === options[key] && ++matchCount === Object.keys(options).length){
					return true;
				}
			}
		});
	}

	async createRecord(domain, options){
		options = this.__parseOptions(options, ['type', 'name', 'data']);
		let res = await this.axios('post', `/domains/${domain.domain}/records`, options);

		return this.__parseRes([res.data.domain_record])[0];
	}

	async deleteRecordById(domain, id){
		let res = await this.axios('delete', `/domains/${domain.domain}/records/${id}`);
	}

	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options)
		for(let record of records){
			let res = await this.deleteRecordById(domain, record.id);
		}

		return true;
	}
}

DnsProvider.extend('dnsProvider', DigitalOcean)
