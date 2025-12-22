'use strict';

const tldExtract = require('tld-extract').parse_host;
const conf = require('../conf');
const Table = require('../utils/redis_model');
const ModelPs = require('../utils/model_pubsub');


class Domain extends Table{
	static _key = 'domain';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'domain': {isRequired: true, type: 'string'},
		'dnsProvider_id': {isRequired: true, type: 'string'},
		'provider': {model: 'DnsProvider', rel:'one', localKey: 'dnsProvider_id'},
		'zoneId': {isRequired: false, type: 'string'},
	}

	static async get(domain, ...args){
		try{
			domain = tldExtract(domain).domain;
		}catch{}

		return await super.get(domain, ...args);
	}

	async getRecords(...args){
		return await this.provider.getRecords(this, ...args);
	}

	async createRecord(...args){
		return await this.provider.createRecord(this, ...args);
	}

	async deleteRecords(...args){
		return await this.provider.deleteRecords(this, ...args);
	}
}

Domain.register(ModelPs(Domain));
