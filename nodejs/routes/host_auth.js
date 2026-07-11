'use strict';

/**
 * Per-host SSO endpoints (#57), served under /__proxy_auth on EVERY proxied host
 * (nginx routes that path here; see ops/nginx_conf/proxy.conf). These run the
 * OIDC authorization-code flow (reusing utils/oidc.js and conf.oidc) and, on a
 * successful + authorized login, mint a Redis-backed SsoSession and set the
 * `__proxy_sso` cookie for the host. OpenResty then gates the host on that
 * session (ops/nginx_conf/hostfeatures.lua).
 *
 * Callback style: per-host (option A) — redirect_uri is
 * https://<host>/__proxy_auth/callback, so each protected host's callback must
 * be an allowed redirect URI at the IdP (a wildcard redirect URI covers all).
 */

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const oidc = require('../utils/oidc');
const {Host} = require('../models').models;
const {HostSsoState, SsoSession} = require('../models/sso_session');
const {identityAllowed} = require('../utils/host_sso');

const COOKIE = (conf.hostSso && conf.hostSso.cookieName) || '__proxy_sso';

// Minimal HTML notice page (these endpoints are hit by browsers, not the API).
function page(message){
	return `<!doctype html><html><head><meta charset="utf-8"><title>Sign in</title>`
		+ `<meta name="viewport" content="width=device-width, initial-scale=1">`
		+ `<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}</style>`
		+ `</head><body><p>${String(message).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p></body></html>`;
}

// This host's own callback URL — must match between authorize and token steps.
function callbackUri(req){
	return `${req.protocol}://${req.get('host')}/__proxy_auth/callback`;
}

// Constrain the post-login redirect to this same host (no open redirect). `rd`
// may be a bare path or a full same-host URL.
function safeRd(req, rd){
	try{
		if(!rd) return '/';
		if(rd.charAt(0) === '/' && rd.charAt(1) !== '/') return rd;
		let u = new URL(rd);
		if(u.host === req.get('host')) return u.pathname + u.search;
	}catch(error){ /* fall through */ }
	return '/';
}

function readCookie(req, name){
	for(let part of (req.headers.cookie || '').split(';')){
		let idx = part.indexOf('=');
		if(idx === -1) continue;
		if(part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
	}
	return null;
}

// Resolve the effective Host record (exact, else via the wildcard lookup tree)
// so we can read its SSO allow-lists.
async function resolveHost(hostname){
	try{ return await Host.get(hostname); }catch(error){ /* try wildcard */ }
	try{ return Host.lookUp(hostname) || null; }catch(error){ return null; }
}

// Begin login: create PKCE/state, remember the target host + return path, and
// redirect the browser to the IdP.
router.get('/start', async function(req, res, next){
	try{
		if(!conf.oidc || !conf.oidc.enabled){
			return res.status(503).send(page('SSO is not configured on this proxy.'));
		}
		let hostname = req.hostname;
		let hostRec = await resolveHost(hostname);
		if(!hostRec || !hostRec.sso_enabled){
			return res.status(404).send(page('SSO is not enabled for this host.'));
		}

		let {state, codeVerifier, codeChallenge} = oidc.createAuthRequest();
		await HostSsoState.create({state, codeVerifier, host: hostname, rd: safeRd(req, req.query.rd)});

		return res.redirect(oidc.buildAuthUrl(state, codeChallenge, callbackUri(req)));
	}catch(error){
		return next(error);
	}
});

// OIDC redirect target: validate state, exchange the code, enforce the host's
// allow-list, then establish the session and return the user to where they were.
router.get('/callback', async function(req, res, next){
	try{
		let {code, state} = req.query;
		if(!code || !state) return res.status(400).send(page('Missing authorization code.'));

		let st = await HostSsoState.get(state).catch(() => null);
		if(!st) return res.status(400).send(page('Your login session expired. Please try again.'));
		await st.remove().catch(() => {});   // one-time use

		let hostname = req.hostname;
		if(st.host !== hostname) return res.status(400).send(page('Login host mismatch.'));

		let tokens = await oidc.exchangeCode(code, st.codeVerifier, callbackUri(req));
		let claims = await oidc.fetchUserInfo(tokens.access_token);
		let identity = oidc.claimsToIdentity(claims);
		let email = claims.email || '';

		let hostRec = await resolveHost(hostname);
		let allowUsers = (hostRec && hostRec.sso_allow_users) || [];
		let allowGroups = (hostRec && hostRec.sso_allow_groups) || [];

		if(!identityAllowed({username: identity.username, email, groups: identity.groups}, allowUsers, allowGroups)){
			return res.status(403).send(page(`You are not authorized to access ${hostname}.`));
		}

		let sid = oidc.randomToken(32);
		await SsoSession.create({sid, host: hostname, sub: identity.username, email, groups: identity.groups || []});

		res.cookie(COOKIE, sid, {
			httpOnly: true,
			secure: req.protocol === 'https',
			sameSite: 'lax',
			path: '/',
			maxAge: SsoSession.ttl() * 1000,
		});
		return res.redirect(safeRd(req, st.rd));
	}catch(error){
		return next(error);
	}
});

// End the session for this host.
router.get('/logout', async function(req, res, next){
	try{
		let sid = readCookie(req, COOKIE);
		if(sid){
			try{ let s = await SsoSession.get(sid); await s.remove(); }catch(error){ /* gone */ }
		}
		res.clearCookie(COOKIE, {path: '/'});
		return res.redirect(safeRd(req, req.query.rd));
	}catch(error){
		return next(error);
	}
});

module.exports = router;
