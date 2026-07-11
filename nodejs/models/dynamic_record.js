'use strict';

const Table = require('.');
const ModelPs = require('../utils/model_pubsub');
const {getPublicIp} = require('../utils/public_ip');

/**
 * DynamicRecord
 *
 * A declared A record that the app keeps pointed at this deployment's current
 * public (WAN) IP, refreshed on a schedule (services/dynamic_dns.js) and on
 * create. `name` is a sub-label, or '@' for the domain apex. One record per
 * (domain, name) — the id is deterministic so re-adding updates in place.
 */
class DynamicRecord extends Table{
	static _key = 'id';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'id': {isRequired: true, type: 'string', min: 1, max: 600},
		'domain': {isRequired: true, type: 'string'},
		'name': {isRequired: true, type: 'string'},
		'last_ip': {isRequired: false, type: 'string'},
		'last_status': {isRequired: false, type: 'string'},
		'last_updated': {isRequired: false, type: 'number'},
	}

	// Deterministic id so the same (domain, name) is a single record.
	static mkId({domain, name}){
		return `${name || '@'}:${domain}`;
	}

	static async create(data){
		// Require an existing Domain (also gives us provider access for updates).
		let Domain = require('.').models.Domain;
		await Domain.get(data.domain);   // throws EntryNotFound if unknown

		data.id = this.mkId(data);
		// Upsert: replace an existing record for the same host rather than 409ing.
		try{
			let existing = await this.get(data.id);
			if(existing) await existing.remove();
		}catch(error){ /* not found is fine */ }

		return super.create(data);
	}

	// Full hostname this record represents.
	fqdn(){
		return (this.name === '@' || !this.name) ? this.domain : `${this.name}.${this.domain}`;
	}

	// Expose a derived fqdn to the client (REST list + websocket payloads both
	// serialize via toJSON), so the UI doesn't depend on client-side parsing.
	toJSON(){
		return {...super.toJSON(), fqdn: this.fqdn()};
	}

	// Point this record at `ip` and record the outcome. Never throws — a single
	// bad record must not abort a whole refresh cycle.
	async apply(ip){
		try{
			let Domain = require('.').models.Domain;
			let domain = await Domain.get(this.domain);
			let res = await domain.upsertARecord(this.name, ip);
			// Empty status on success so the UI only surfaces actual errors.
			await this.update({last_ip: ip, last_status: '', last_updated: Date.now()});
			return res;
		}catch(error){
			console.error('DynamicRecord.apply', this.id, error.message);
			try{
				await this.update({last_status: String(error.message).slice(0, 480), last_updated: Date.now()});
			}catch(e){ /* best effort */ }
			return {error: error.message};
		}
	}

	// Resolve the public IP once, then reconcile every record to it.
	static async refreshAll(){
		let ip;
		try{
			ip = await getPublicIp();
		}catch(error){
			console.error('DynamicRecord.refreshAll: public IP lookup failed', error.message);
			return {error: error.message};
		}

		let records = await this.listDetail();
		for(let record of records){
			await record.apply(ip);
		}
		return {ip, count: records.length};
	}
}

DynamicRecord.register(ModelPs(DynamicRecord));
