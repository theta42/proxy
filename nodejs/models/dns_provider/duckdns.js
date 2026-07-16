'use strict';

const axios = require('axios');
const dns = require('node:dns').promises;
const {DnsApi} = require('./common');

/*
DuckDNS is a free dynamic DNS service: an operator registers one or more
subdomains under duckdns.org (e.g. "myhost" -> myhost.duckdns.org) on the
DuckDNS website, then updates that name's records with a single
account-wide token. Its API is much smaller than a full DNS provider's:

- There is no read or list API. `getRecords` here resolves the domain via
  public DNS instead, since that's the only source of truth available.
- There's no API to enumerate which subdomains a token owns either, so the
  operator supplies them directly (the `subdomains` field below) rather than
  them being discovered like the other providers.
- Only one A record, one AAAA record, and one TXT record exist per domain,
  always at the domain's own apex — DuckDNS has no concept of sub-records
  under a registered name. createRecord/deleteRecordById are written
  around that; other record types are rejected with a clear error.
*/
class DuckDns extends DnsApi{
	static _keyMap = {
		token: {isRequired: true, type: 'string', isPrivate: true, displayName: 'Token'},
		subdomains: {isRequired: true, type: 'string', displayName: 'Subdomains (comma-separated, e.g. "myhost,myhost2")'},
	}

	static displayName = 'DuckDNS';
	static displayIconUni = '&#xf6d9;'
	static displayIconHtml = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
	<circle cx="512" cy="512" r="512" style="fill:#3ca7d5"/>
	<path d="M512 256c-141.4 0-256 114.6-256 256s114.6 256 256 256 256-114.6 256-256-114.6-256-256-256zm0 448c-106 0-192-86-192-192s86-192 192-192 192 86 192 192-86 192-192 192z" style="fill:#fff"/>
	<circle cx="512" cy="512" r="96" style="fill:#fff"/>
</svg>`

	constructor(args){
		super()
		this.token = args.token;
		this.subdomains = args.subdomains;
	}

	// DuckDNS has one endpoint for everything: setting ip/ipv6 updates the
	// A/AAAA record, setting txt updates the TXT record, clear=true wipes
	// the field being set. It always responds 200 with a body of "OK"/"KO"
	// rather than using HTTP error codes, so auth failures are read from
	// the body, not caught as an axios error.
	async update(domains, params){
		let query = new URLSearchParams({domains, token: this.token, verbose: 'true', ...params});
		let res = await axios.get(`https://www.duckdns.org/update?${query}`);
		let [status] = String(res.data).trim().split('\n');

		if(status !== 'OK') throw this.errors.unauthorized();
	}

	// Accepts either the bare label ("myhost") or the full duckdns.org name
	// ("myhost.duckdns.org", how DuckDNS's own site displays it, and what
	// operators naturally paste in) — strip a trailing ".duckdns.org" so
	// both forms end up as the same label. Without this, "myhost.duckdns.org"
	// would get double-suffixed to "myhost.duckdns.org.duckdns.org", which
	// tld-extract (not aware duckdns.org is a shared suffix) then misparses
	// as domain "duckdns.org" — surfacing as a confusing "Domain:duckdns.org
	// does not exists" error two layers away from the actual cause.
	__normalizeLabel(value){
		return value.replace(/\.duckdns\.org$/i, '').toLowerCase();
	}

	// No API to enumerate owned subdomains, so the operator supplies them.
	// This call validates the token by writing a fixed marker to the TXT
	// record only -- never `ip`/`ipv6` -- so adding/validating a provider
	// never changes where the domain's A/AAAA records actually point. (An
	// earlier version omitted `ip` here, which made DuckDNS auto-detect and
	// apply this host's public IP as a side effect of validation; that's
	// exactly what this call must not do.)
	async listDomains(){
		let labels = this.subdomains.split(',').map(d => this.__normalizeLabel(d.trim())).filter(Boolean);
		await this.update(labels.join(','), {txt: 'theta42-proxy-validated'});

		return labels.map(label => ({domain: `${label}.duckdns.org`}));
	}

	__label(domain){
		return domain.domain.replace(/\.duckdns\.org$/i, '');
	}

	// No read API exists; public DNS is the only source of truth available.
	async getRecords(domain, options){
		let records = [];

		for(let [type, resolve] of [['A', 'resolve4'], ['AAAA', 'resolve6']]){
			try{
				let [data] = await dns[resolve](domain.domain);
				records.push({id: type, type, name: '', data});
			}catch{}
		}
		try{
			let [data] = await dns.resolveTxt(domain.domain);
			records.push({id: 'TXT', type: 'TXT', name: '', data: data.join('')});
		}catch{}

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

	// DuckDNS records only exist at the domain's own apex; there is no
	// sub-record concept to map a name onto.
	apexName(domainName){
		return '@';
	}

	async createRecord(domain, options){
		options = this.__parseOptions(options, ['type', 'data']);
		let label = this.__label(domain);

		if(options.type === 'A') await this.update(label, {ip: options.data});
		else if(options.type === 'AAAA') await this.update(label, {ipv6: options.data});
		else if(options.type === 'TXT') await this.update(label, {txt: options.data});
		else throw this.errors.other(400, `DuckDNS only supports A, AAAA and TXT records, got '${options.type}'`);

		return {id: options.type, type: options.type, name: '', data: options.data};
	}

	async deleteRecordById(domain, id){
		let label = this.__label(domain);

		if(id === 'A') await this.update(label, {ip: '', clear: 'true'});
		else if(id === 'AAAA') await this.update(label, {ipv6: '', clear: 'true'});
		else if(id === 'TXT') await this.update(label, {txt: '', clear: 'true'});
	}

	async deleteRecords(domain, options){
		let records = await this.getRecords(domain, options);
		for(let record of records){
			await this.deleteRecordById(domain, record.id);
		}

		return true;
	}
}

module.exports = DuckDns;
