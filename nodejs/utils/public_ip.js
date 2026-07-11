'use strict';

// Discover this deployment's current public (WAN) IP by asking an external echo
// service. Used by the dynamic-DNS feature to keep A records pointed at the box
// even on WAN DHCP. Pure helpers (isIPv4/extractIp) are unit-tested; getPublicIp
// does the network calls.

const axios = require('axios');
const conf = require('@simpleworkjs/conf');

const DEFAULT_SERVICES = [
	'https://api.ipify.org',
	'https://icanhazip.com',
	'https://ifconfig.me/ip',
];

// Strict dotted-quad IPv4 check (0-255 per octet).
function isIPv4(str){
	if(typeof str !== 'string') return false;
	let m = str.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if(!m) return false;
	for(let i = 1; i <= 4; i++){
		if(Number(m[i]) > 255) return false;
	}
	return true;
}

// Pull an IPv4 out of a service response, which may be bare text ("1.2.3.4\n")
// or JSON ({"ip":"1.2.3.4"}). Returns the IP string or null.
function extractIp(body){
	if(body === undefined || body === null) return null;

	if(typeof body === 'object'){
		let candidate = body.ip || body.address || body.origin;
		return isIPv4(candidate) ? candidate.trim() : null;
	}

	let text = String(body).trim();
	if(isIPv4(text)) return text;

	// Some endpoints wrap the value; try to find the first IPv4 token.
	let m = text.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
	return m && isIPv4(m[1]) ? m[1] : null;
}

// Try each configured service in order; return the first valid IPv4. Throws if
// they all fail so the caller can log and skip this cycle.
async function getPublicIp(){
	let services = (conf.dynamicDns && conf.dynamicDns.ipServices) || DEFAULT_SERVICES;
	let lastError;

	for(let url of services){
		try{
			let res = await axios.get(url, {timeout: 5000, responseType: 'text'});
			let ip = extractIp(res.data);
			if(ip) return ip;
			lastError = new Error(`No IPv4 in response from ${url}`);
		}catch(error){
			lastError = error;
		}
	}

	let error = new Error('PublicIpUnavailable');
	error.name = 'PublicIpUnavailable';
	error.message = `Could not determine public IP: ${lastError && lastError.message}`;
	throw error;
}

module.exports = {isIPv4, extractIp, getPublicIp, DEFAULT_SERVICES};
