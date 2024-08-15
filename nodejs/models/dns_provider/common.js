'use strict';

const tldExtract = require('tld-extract').parse_host;

class DnsApi{
	errors = {
		unauthorized: ()=>{
			let error = new Error('UnauthorizedDnsApi');
			error.name = 'UnauthorizedDnsApi';
			error.message = `Unauthorized call to ${this.constructor.name}`;
			error.status = 424;

			return error;
		},
		invalidInput: (keys)=>{
			let error = new Error('InvalidInput');
			error.name = 'InvalidInput';
			error.message = `Required keys missing: ${keys.join(', ')}`

			return error

		},
		other: (status, message, APIcode)=>{
			let error = new Error('OtherDnsApiError');
			error.name = 'OtherDnsApiError';
			error.message = `DNS API Error ${this.constructor.name}: ${status} ${message}`;
			error.status = 424;
			error.APIcode = APIcode;
			return error;
		},
	}

	static info(){
		let svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.displayIconHtml)
		  .replace(/'/g, '%27')
		  .replace(/"/g, '%22')}`

		return {
			displayName: this.displayName,
			displayIconUni: this.displayIconUni,
			displayIconHtml: svgDataUrl,
			fields: this._keyMap,
		}
	}

	static toJSON(){
		return {
			...this.info(),
		}
	}

	/*
	No instance data should ever be shared, so just give the static level inf 
	*/
	toJSON(){
		return this.constructor.toJSON();
	}


	__typeCheck(type){
		if(!['A', 'MX', 'CNAME', 'ALIAS', 'TXT', 'NS', 'AAAA', 'SRV', 'TLSA', 'CAA', 'HTTPS', 'SVCB'].includes(type)) throw new Error('PorkBun API: Invalid type passed')
	}


	/*
	The API and the generic class interface have different opinions of what keys
	hold what data, the __parseOptions and __pastseRes normal the keys to what
	the class expects

	What the the API calls it : What the class wants it as.
	*/
	__apiKeyMap = {};

	__parseOptions(options, keys){
		if(!options && !keys) return undefined;

		if(keys){
			let missingKeys = []
			for(let key of keys){
				if(!options[key]) missingKeys.push(key)
			}

			if(missingKeys.length) throw this.errors.invalidInput(missingKeys);
		}

		for(let [apiKey, clsKey] of Object.entries(this.__apiKeyMap)){
			if(options[clsKey]){
				options[apiKey] = options[clsKey];
				delete options[clsKey];
			}
		}

		if(options.type) this.__typeCheck(options.type);

		return options;
	}

	__parseRes(data){
		for(let item of data){
			for(let [apiKey, clsKey] of Object.entries(this.__apiKeyMap)){
				if(item[apiKey]){
					item[clsKey] = item[apiKey];
				}
			}
			try{
				item.name = tldExtract(item.name).sub
			}catch{}
		}

		return data;
	}
}

module.exports = {
	DnsApi,
};

