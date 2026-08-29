'use strict';

/**
 * Pure helpers for the per-host SSO endpoints (routes/host_auth.js). Kept in
 * their own no-dependency module so they can be unit-tested without loading the
 * model layer (which wants Redis).
 *
 * @module utils/host_auth_redirect
 */

/**
 * Constrain the per-host SSO post-login redirect to this same host.
 *
 * `rd` may be a bare path or a full same-host URL. Rejects anything that could
 * navigate the browser off-site (open redirect):
 *   - empty/missing input            -> "/"
 *   - protocol-relative "//host"     -> "/" (host takeover)
 *   - backslash "/\host"             -> "/" (host takeover: `/\evil.com`)
 *   - a full URL for a different host -> "/"
 * A full URL matching this host returns only its path + search (origin
 * stripped). A plain "/path" passes through.
 *
 * @param {object} req - Express-like request (only req.get('host') is read)
 * @param {string|undefined} rd - the raw redirect target
 * @returns {string} a safe, same-origin path, or "/"
 */
function safeRd(req, rd){
	try{
		if(!rd) return '/';
		// Reject protocol-relative "//host" and "/\host" host takeover tricks.
		if(rd.charAt(0) === '/' && rd.charAt(1) !== '/' && rd.charAt(1) !== '\\') return rd;
		let u = new URL(rd);
		if(u.host === req.get('host')) return u.pathname + u.search;
	}catch(error){ /* fall through */ }
	return '/';
}

/**
 * This host's own OIDC callback URL.
 *
 * Always https: behind a TLS-terminating proxy `req.protocol` /
 * `X-Forwarded-Proto` can be http, but the registered redirect wildcards are
 * https-only, so the callback must be https or the OIDC exchange fails on
 * every host.
 *
 * @param {object} req - Express-like request (only req.get('host') is read)
 * @returns {string} absolute https callback URL
 */
function callbackUri(req){
	return `https://${req.get('host')}/__proxy_auth/callback`;
}

module.exports = {safeRd, callbackUri};
