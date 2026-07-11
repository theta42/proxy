'use strict';

const crypto = require('crypto');

/**
 * Server-only hashing for per-host basic-auth credentials. Kept out of the pure,
 * browser-mirrored utils/host_features.js because it needs Node crypto.
 *
 * Passwords are stored as base64(SHA-1(password)) — the Apache htpasswd "{SHA}"
 * scheme — so plaintext never lands in Redis. OpenResty verifies with the same
 * hash (ops/nginx_conf/hostfeatures.lua): base64(sha1(password)).
 *
 * SHA-1 is weak for password storage in general, but this is a lightweight proxy
 * gate (not the app's own accounts) and matches htpasswd; upgrading the scheme is
 * a follow-up. Enforce strong passwords operationally.
 */
function hashPassword(password){
	return crypto.createHash('sha1').update(String(password)).digest('base64');
}

// { username: plaintext } -> { username: base64sha1 }. Skips empty passwords.
function hashBasicAuthUsers(users){
	let out = {};
	if(!users || typeof users !== 'object') return out;
	for(let user of Object.keys(users)){
		let pass = users[user];
		if(pass === undefined || pass === null || pass === '') continue;
		out[user] = hashPassword(pass);
	}
	return out;
}

module.exports = {hashPassword, hashBasicAuthUsers};
