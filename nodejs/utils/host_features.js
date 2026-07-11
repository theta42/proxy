'use strict';

// Pure helpers for the per-host reverse-proxy controls (rate limiting, response
// caching, custom/security headers, IP allow/deny). Shared by the server route
// (`routes/host.js`) for authoritative validation and mirrored by the browser
// form code (`public/js/app.js`) so client and server agree on the wire shape.
//
// No dependencies, no I/O — everything here is deterministic and unit-tested by
// test/unit/host_features.test.js.

const MAX_HEADERS = 50;          // per direction (req/resp)
const MAX_HEADER_VALUE = 2048;   // chars
const MAX_CIDRS = 200;           // per list (allow/deny)
const MAX_BASICAUTH_USERS = 100;
const MAX_PASSWORD = 256;
const MAX_REALM = 128;

// Basic-auth username: printable ASCII, no space or control chars. ':' can't
// appear (we split on the first ':'), but the class excludes it anyway.
const BASICAUTH_USER_RE = /^[\x21-\x39\x3B-\x7e]+$/;

// RFC 7230 header field-name token characters.
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * "Name: value" lines -> { Name: value }. Invalid names are dropped; CR/LF are
 * stripped from values to prevent header/response splitting. First ':' splits.
 */
function parseHeaderLines(text){
	let out = {};
	if(text === undefined || text === null) return out;
	let lines = String(text).split(/\r?\n/);

	for(let line of lines){
		if(!line.trim()) continue;
		let idx = line.indexOf(':');
		if(idx === -1) continue;

		let name = line.slice(0, idx).trim();
		let value = line.slice(idx + 1).trim();

		if(!HEADER_NAME_RE.test(name)) continue;
		value = value.replace(/[\r\n]/g, '').slice(0, MAX_HEADER_VALUE);

		out[name] = value;
		if(Object.keys(out).length >= MAX_HEADERS) break;
	}

	return out;
}

/** { Name: value } -> "Name: value" lines (for populating the edit form). */
function stringifyHeaders(obj){
	if(!obj || typeof obj !== 'object') return '';
	return Object.keys(obj)
		.map(name => `${name}: ${obj[name]}`)
		.join('\n');
}

/**
 * Sanitize an already-object header map (e.g. a JSON body) the same way
 * parseHeaderLines sanitizes text: valid token names only, CR/LF-stripped
 * values, capped count.
 */
function sanitizeHeaderObject(obj){
	let out = {};
	if(!obj || typeof obj !== 'object') return out;

	for(let name of Object.keys(obj)){
		if(!HEADER_NAME_RE.test(name)) continue;
		let value = String(obj[name]).replace(/[\r\n]/g, '').slice(0, MAX_HEADER_VALUE);
		out[name] = value;
		if(Object.keys(out).length >= MAX_HEADERS) break;
	}

	return out;
}

/** True for a plausible IPv4 or IPv6 address with an optional CIDR suffix. */
function isValidCidr(entry){
	if(typeof entry !== 'string') return false;
	let s = entry.trim();
	if(!s) return false;

	// IPv4, optional /0-32.
	let m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
	if(m){
		for(let i = 1; i <= 4; i++){
			if(Number(m[i]) > 255) return false;
		}
		if(m[5] !== undefined && Number(m[5]) > 32) return false;
		return true;
	}

	// IPv6 (loose — resty.ipmatcher does the authoritative parse), optional /0-128.
	if(/^[0-9A-Fa-f:]+(?:\/\d{1,3})?$/.test(s) && s.indexOf(':') !== -1){
		let slash = s.indexOf('/');
		if(slash !== -1 && Number(s.slice(slash + 1)) > 128) return false;
		return true;
	}

	return false;
}

/** Newline/whitespace-separated text -> array of valid CIDR strings. */
function parseCidrLines(text){
	if(text === undefined || text === null) return [];
	return sanitizeCidrArray(String(text).split(/[\s,]+/));
}

/** array -> deduped array of valid CIDR strings, capped. */
function sanitizeCidrArray(arr){
	if(!Array.isArray(arr)) return [];
	let seen = new Set();
	let out = [];

	for(let raw of arr){
		let s = String(raw).trim();
		if(!s || seen.has(s)) continue;
		if(!isValidCidr(s)) continue;
		seen.add(s);
		out.push(s);
		if(out.length >= MAX_CIDRS) break;
	}

	return out;
}

/** array -> newline-joined text (for populating the edit form). */
function stringifyCidrs(arr){
	if(!Array.isArray(arr)) return '';
	return arr.join('\n');
}

/**
 * "username:password" lines -> { username: password } (plaintext). The first
 * ':' splits; usernames are validated and CR/LF is stripped from passwords.
 * Lines without a password are dropped. Hashing happens server-side
 * (utils/basicauth.js) — this stays pure so the browser can share it.
 */
function parseBasicAuthLines(text){
	let out = {};
	if(text === undefined || text === null) return out;

	for(let line of String(text).split(/\r?\n/)){
		line = line.replace(/[\r\n]/g, '');
		if(!line.trim()) continue;
		let idx = line.indexOf(':');
		if(idx === -1) continue;

		let user = line.slice(0, idx).trim();
		let pass = line.slice(idx + 1).slice(0, MAX_PASSWORD);
		if(!user || !pass) continue;
		if(!BASICAUTH_USER_RE.test(user)) continue;

		out[user] = pass;
		if(Object.keys(out).length >= MAX_BASICAUTH_USERS) break;
	}
	return out;
}

/** Sanitize an already-object credential map ({user: password}) the same way. */
function sanitizeBasicAuthObject(obj){
	let out = {};
	if(!obj || typeof obj !== 'object') return out;

	for(let user of Object.keys(obj)){
		if(!BASICAUTH_USER_RE.test(user)) continue;
		let pass = String(obj[user]).replace(/[\r\n]/g, '').slice(0, MAX_PASSWORD);
		if(!pass) continue;
		out[user] = pass;
		if(Object.keys(out).length >= MAX_BASICAUTH_USERS) break;
	}
	return out;
}

/** Realm goes into a WWW-Authenticate header; strip CR/LF and quotes, cap len. */
function sanitizeRealm(value){
	return String(value === undefined || value === null ? '' : value)
		.replace(/[\r\n"]/g, '')
		.trim()
		.slice(0, MAX_REALM);
}

function toBool(v){
	return v === true || v === 'true';
}

/** Coerce a number into [min, max], falling back to `def` for junk. */
function clampNumber(v, min, max, def){
	let n = Number(v);
	if(!Number.isFinite(n)) return def;
	n = Math.floor(n);
	if(n < min) return min;
	if(n > max) return max;
	return n;
}

/**
 * Coerce/validate only the per-host feature fields that are PRESENT in `body`,
 * in place, returning it. Absent fields are left untouched so partial updates
 * (PUT) don't reset unspecified controls. Accepts both the browser wire shape
 * (objects/arrays) and raw text (curl users), normalizing to the stored shape.
 */
function normalizeHostFeatures(body){
	if(!body || typeof body !== 'object') return body;

	if('ratelimit_enabled' in body) body.ratelimit_enabled = toBool(body.ratelimit_enabled);
	if('respcache_enabled' in body)  body.respcache_enabled  = toBool(body.respcache_enabled);
	if('hsts_enabled' in body)       body.hsts_enabled       = toBool(body.hsts_enabled);
	if('basicauth_enabled' in body)  body.basicauth_enabled  = toBool(body.basicauth_enabled);

	if('basicauth_realm' in body) body.basicauth_realm = sanitizeRealm(body.basicauth_realm);

	if('basicauth_users' in body){
		let users = typeof body.basicauth_users === 'string'
			? parseBasicAuthLines(body.basicauth_users)
			: sanitizeBasicAuthObject(body.basicauth_users);
		// Empty input means "leave the existing users untouched" (passwords are
		// never echoed to the form, so a blank textarea must not wipe them). Drop
		// the key so the partial update skips it. Disable basic auth to clear.
		if(Object.keys(users).length === 0){
			delete body.basicauth_users;
		}else{
			body.basicauth_users = users;
		}
	}

	if('ratelimit_rate' in body)  body.ratelimit_rate  = clampNumber(body.ratelimit_rate, 1, 1000000, 10);
	if('ratelimit_burst' in body) body.ratelimit_burst = clampNumber(body.ratelimit_burst, 0, 1000000, 20);

	if('req_headers' in body){
		body.req_headers = typeof body.req_headers === 'string'
			? parseHeaderLines(body.req_headers)
			: sanitizeHeaderObject(body.req_headers);
	}
	if('resp_headers' in body){
		body.resp_headers = typeof body.resp_headers === 'string'
			? parseHeaderLines(body.resp_headers)
			: sanitizeHeaderObject(body.resp_headers);
	}

	if('ip_allow' in body){
		body.ip_allow = typeof body.ip_allow === 'string'
			? parseCidrLines(body.ip_allow)
			: sanitizeCidrArray(body.ip_allow);
	}
	if('ip_deny' in body){
		body.ip_deny = typeof body.ip_deny === 'string'
			? parseCidrLines(body.ip_deny)
			: sanitizeCidrArray(body.ip_deny);
	}

	return body;
}

module.exports = {
	MAX_HEADERS, MAX_HEADER_VALUE, MAX_CIDRS, MAX_BASICAUTH_USERS,
	parseHeaderLines, stringifyHeaders, sanitizeHeaderObject,
	isValidCidr, parseCidrLines, sanitizeCidrArray, stringifyCidrs,
	parseBasicAuthLines, sanitizeBasicAuthObject, sanitizeRealm,
	normalizeHostFeatures,
};
