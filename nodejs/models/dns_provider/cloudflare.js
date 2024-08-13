'use strict';

const axios = require('axios');
const {dnsErrors} = require('./common');

//like the options obj will always use domain data and type
// change content to data 
// change name to domain


class CloudFlare{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Token'},
	}

	static displayName = 'CloudFlare'
	static displayIconHtml = `
    <svg width="32px" height="32px" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <circle cx="512" cy="512" r="512" style="fill:#0080ff"/>
    <path d="m273.8 669.2-.1-63.7h63.7v63.7h76v-98.8h98.8v98.5c105.1-.1 186.2-104.1 146.1-214.6-14.9-40.9-47.6-73.6-88.5-88.4-110.7-40.2-214.7 41.2-214.7 146.3H256c0-167.5 161.8-298 337.4-243.2 76.8 24 137.7 84.9 161.6 161.6C809.9 606.2 679.4 768 511.9 768v-98.8h-98.6v75.9h-75.9v-75.9h-63.6z" style="fill:#fff"/>
    </svg>`
	// Cloud icon for cloudflare
	static displayIconUni =  '&#xf0c2;'

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
	};

	async axios(method, ...args){
		try{
			let a = axios.create({
				baseURL: 'https://api.cloudflare.com/client/v4/zones',
				headers: {Authorization: `Bearer ${this.token}`}
			});
			// console.log(a)
			// console.log(...args)
			return await a[method](...args);
		}catch(error){
			console.log(error)
			if(!error.response) throw error;
			if(error.response.data || error.response.data.id === 'Unauthorized'){
				throw dnsErrors.unauthorized(this);
			}
			throw dnsErrors.other(this, error.response.status, error.response.data.message);
		}
	}


	async listDomains(){
        let res = await this.axios('get');
        // return res.data.result;
        for(let domain of res.data.result){
			domain.domain = domain.name
            domain.id = domain.id
		}
		return res.data.result;
	}

    //get records
	async getRecords(domain, options={}){
		this.__typeCheck(options.type);
        //like the options obj will always use domain data and type
        // change content to data 
        // change name to domain

        let res = await this.axios('get', `${domain.zoneId}/dns_records`, {params: options})

        for (let record of res.data.result){
            record.domain = record.name
            record.data = record.content
        }
        return res.data.result;

	}

	async createRecord(domain, options){
		this.__typeCheck(options.type);
		//POST zones/:zone_identifier/dns_records
		// name , type , ip / content , ttl 

		if(!options.content) throw new Error(`${this.constructor.name} API: 'data' key is required for this action`)


		let res = await this.axios('post', `${domain.zoneId}/dns_records`, options);
		return res;

	}

	async deleteRecordById(domain, id){
		let res = await this.axios('delete', `${domain.zoneId}/dns_records/${id}`);	
	}

	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options)
		for(let record of records){
			let res = await this.deleteRecordById(domain, record.id);
			// // console.log(record)
			// console.log(record.id)
		}

		return true;
	}
}

module.exports = CloudFlare;


if(require.main === module){(async function(){try{
    // let cf = new CloudFlare(""); 
    // let domain = {
    //     domain: "example.uk",
    //     zoneId: "5eb25c12cd7d22f11252330a29a0dd77"
    // }

	// console.log(await cf.listDomains())

    //content = ip
    //name = domain
	// console.log('get', await cf.getRecords(domain, {content: '172.206.221.130'}))

	// console.log('post', await cf.createRecord(domain, {name:'test', content: '10.0.0.1', type: "TXT"}))

	// console.log('delete', await cf.deleteRecordById(domain , "5c0e958c3406a34d011459933d538b78"))

	// console.log('delete', await cf.deleteRecords(domain, {type: 'A'}))

}catch(error){
	console.log('IIFE Error:', error)
}})()}
