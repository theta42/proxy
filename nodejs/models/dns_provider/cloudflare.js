'use strict';

const axios = require('axios');
const {dnsErrors, DnsApi} = require('./common');

//like the options obj will always use domain data and type
// change content to data 
// change name to domain


class CloudFlare extends DnsApi{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'API Token'},
	}

	static displayName = 'CloudFlare'
	static displayIconHtml = `
		<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
			<circle cx="512" cy="512" r="512" style="fill:#f38020"/>
			<path d="M608.2 592.4c3.1-10.8 1.9-20.7-3.3-28.1-4.8-6.7-12.9-10.6-22.6-11.1l-184.7-2.4c-1.1 0-2.2-.6-2.8-1.5-.6-.9-.7-2.1-.4-3.3.6-1.8 2.4-3.2 4.3-3.3l186.4-2.4c22.1-1 46.1-18.9 54.5-40.8l10.6-27.8c.5-1.2.6-2.4.3-3.6-12-54.3-60.5-94.8-118.4-94.8-53.4 0-98.7 34.5-114.9 82.4-10.5-7.8-23.9-12-38.3-10.6-25.7 2.5-46.2 23.1-48.8 48.8-.6 6.6-.1 13.1 1.4 19.1-41.9 1.2-75.3 35.4-75.3 77.6 0 3.7.3 7.5.8 11.2.3 1.8 1.8 3.1 3.6 3.1h340.9c1.9 0 3.8-1.4 4.3-3.3l2.4-9.2zM667 473.7c-1.6 0-3.4 0-5.1.2-1.2 0-2.2.9-2.7 2.1l-7.2 25c-3.1 10.8-2 20.7 3.3 28.1 4.8 6.7 12.9 10.6 22.7 11.1l39.3 2.4c1.2 0 2.3.6 2.8 1.5.6.9.7 2.3.5 3.3-.6 1.8-2.4 3.2-4.4 3.3l-41 2.4c-22.2 1-46 18.9-54.5 40.8l-3 7.6c-.6 1.5.5 3 2.1 3h140.8c1.6 0 3.1-1 3.6-2.7 2.4-8.7 3.7-17.9 3.7-27.3 0-55.5-45.3-100.8-101-100.8" style="fill:#fff"/>
		</svg>`
	// Cloud icon for cloudflare
	static displayIconUni =  '&#xf0c2;'

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
	};

	async axios(method, ...args){
		try{
			let a = axios.create({
                
				baseURL: 'https://api.cloudflare.com/client/v4/zones',
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
		// if(!options.data) throw new Error(`${this.constructor.name} API: 'data' key is required for this action`)
		// if(options.name) options.name = this.__parseName(domain, options.name);

		// let res = await this.axios('post', `/domains/${domain}/records`, options);
		// return res.data;
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

module.exports = CloudFlare;


if(require.main === module){(async function(){try{
    let cf = new CloudFlare("RaA7Ej-eLBfc_hhCeMVhvPEZTmrHh2WXfPpUCUIL"); 
    let domain = {
        domain: "teeseng.uk",
        zoneId: "11f8ec3c2ff0530fe6f1b97dfe4b8f74"
    }

	// console.log(await cf.listDomains())

    //content = ip
    //name = domain
	// console.log('get', await cf.getRecords(domain, {content: '172.206.221.130'}))

	console.log('make', await cf.createRecord('rm-rf.stream', {name:'_test', data: '890', type: "TXT"}))
	// console.log('delete', await digi.deleteRecords('rm-rf.stream', {type: 'TXT'}))

}catch(error){
	console.log('IIFE Error:', error)
}})()}
