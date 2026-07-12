'use strict';

const crypto = require('crypto');
const conf = require('@simpleworkjs/conf');

/**
 * Minimal OpenID Connect authorization-code + PKCE client.
 *
 * The SSO publishes no jwks_uri, so we do not verify ID-token signatures;
 * instead we treat the flow as opaque and read identity from the userinfo
 * endpoint (the access token is exchanged server-side over TLS). Uses Node's
 * global fetch (Node 18+) and crypto — no external dependency.
 *
 * All endpoints and client config come from conf.oidc (+ clientSecret from
 * secrets.js, deep-merged by @simpleworkjs/conf).
 */

const base64url = buf => buf.toString('base64')
	.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// A high-entropy random string for `state` / PKCE verifier.
function randomToken(bytes = 32){
	return base64url(crypto.randomBytes(bytes));
}

// PKCE S256 challenge derived from the verifier.
function codeChallengeS256(verifier){
	return base64url(crypto.createHash('sha256').update(verifier).digest());
}

// Generate the {state, codeVerifier, codeChallenge} triple for a new login.
function createAuthRequest(){
	let state = randomToken(32);
	let codeVerifier = randomToken(32);
	let codeChallenge = codeChallengeS256(codeVerifier);
	return {state, codeVerifier, codeChallenge};
}

// Build the SSO authorize URL the browser is redirected to. `redirectUri`
// overrides conf.oidc.redirectUri (per-host SSO uses a per-host callback).
function buildAuthUrl(state, codeChallenge, redirectUri){
	let o = conf.oidc;
	let params = new URLSearchParams({
		response_type: 'code',
		client_id: o.clientId,
		redirect_uri: redirectUri || o.redirectUri,
		scope: (o.scopes || ['openid', 'profile', 'email', 'groups']).join(' '),
		state,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
	});
	return `${o.authorizationEndpoint}?${params.toString()}`;
}

// Exchange an authorization code for tokens at the token endpoint. `redirectUri`
// must match the one used in buildAuthUrl (per-host for per-host SSO).
async function exchangeCode(code, codeVerifier, redirectUri){
	let o = conf.oidc;
	let body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri || o.redirectUri,
		client_id: o.clientId,
		client_secret: o.clientSecret,
		code_verifier: codeVerifier,
	});

	let res = await fetch(o.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept': 'application/json',
		},
		body: body.toString(),
	});

	if(!res.ok){
		let text = await res.text().catch(() => '');
		let error = new Error('OidcTokenExchangeFailed');
		error.name = 'OidcTokenExchangeFailed';
		error.message = `Token exchange failed (${res.status}): ${text}`;
		error.status = 502;
		throw error;
	}

	return res.json();
}

// Fetch the userinfo claims for an access token.
async function fetchUserInfo(accessToken){
	let o = conf.oidc;
	let res = await fetch(o.userinfoEndpoint, {
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Accept': 'application/json',
		},
	});

	if(!res.ok){
		let error = new Error('OidcUserInfoFailed');
		error.name = 'OidcUserInfoFailed';
		error.message = `Userinfo request failed (${res.status})`;
		error.status = 502;
		throw error;
	}

	return res.json();
}

// Pull the app username and group list out of userinfo claims per conf.
function claimsToIdentity(claims){
	let o = conf.oidc;
	let username = claims[o.usernameClaim || 'preferred_username'] || claims.sub;
	let groups = claims[o.groupsClaim || 'groups'] || [];
	if(!Array.isArray(groups)) groups = [groups].filter(Boolean);
	return {username, groups, claims};
}

module.exports = {
	randomToken,
	codeChallengeS256,
	createAuthRequest,
	buildAuthUrl,
	exchangeCode,
	fetchUserInfo,
	claimsToIdentity,
};
