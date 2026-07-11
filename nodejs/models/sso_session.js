'use strict';

const Table = require('.');
const conf = require('@simpleworkjs/conf');

/**
 * Per-host SSO models (#57).
 *
 * HostSsoState — short-lived, in-flight OIDC authorization request for a
 * protected host (like OidcState, but carries the target host + post-login
 * redirect). Auto-expires via TTL.
 *
 * SsoSession — an established session after a successful, authorized login.
 * Keyed by a random session id stored in the browser's `__proxy_sso` cookie.
 * OpenResty (ops/nginx_conf/hostfeatures.lua) reads `proxy_SsoSession_<sid>`
 * straight from Redis to gate requests; the allow-list was already enforced at
 * callback time (utils/host_sso.js), so the Lua side only checks that a session
 * exists and belongs to this host. Auto-expires via TTL.
 */

const SESSION_TTL = (conf.hostSso && conf.hostSso.sessionTtl) || 28800; // 8h

class HostSsoState extends Table{
	static _key = 'state';
	static _ttl = 300; // 5 minutes bounds the auth round-trip / replay
	static _keyMap = {
		'created_on': {default: function(){return (new Date).getTime()}},
		'state': {isRequired: true, type: 'string', min: 8, max: 500},
		'codeVerifier': {isRequired: true, type: 'string', min: 8, max: 500},
		'host': {isRequired: true, type: 'string', min: 1, max: 500},
		'rd': {default: '/', isRequired: false, type: 'string'},
	}
}
HostSsoState.register();

class SsoSession extends Table{
	static _key = 'sid';
	static _ttl = SESSION_TTL;
	static _keyMap = {
		'created_on': {default: function(){return (new Date).getTime()}},
		'sid': {isRequired: true, type: 'string', min: 16, max: 500},
		'host': {isRequired: true, type: 'string', min: 1, max: 500},
		'sub': {isRequired: true, type: 'string', min: 1, max: 500},
		'email': {default: '', isRequired: false, type: 'string'},
		'groups': {default: function(){return []}, isRequired: false, type: 'object'},
	}

	static ttl(){ return SESSION_TTL; }
}
SsoSession.register();

module.exports = {HostSsoState, SsoSession};
