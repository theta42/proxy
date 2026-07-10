'use strict';

const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const conf = require('@simpleworkjs/conf');
const { Auth } = require('../models/auth');
const { OidcState } = require('../models/oidc_state');
const oidc = require('../utils/oidc');
const { safeInternalPath } = require('../utils/safe_redirect');

// Throttle unauthenticated auth endpoints (credential login + the OIDC
// handshake) to blunt brute-force / callback abuse. Keyed per IP.
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,   // 15 minutes
	max: 60,                    // 60 attempts per IP per window
	standardHeaders: true,
	legacyHeaders: false,
	message: {name: 'TooManyRequests', message: 'Too many attempts, please try again later.'},
});


router.post('/login', authLimiter, async function(req, res, next){
	try{
		let auth = await Auth.login(req.body);
		return res.json({
			login: true,
			token: auth.token.token,
			message:`${req.body.username} logged in!`,
		});
	}catch(error){
		next(error);
	}
});

router.all('/logout', async function(req, res, next){
	try{
		if(req.user){
			await req.user.logout();
		}

		res.json({message: 'Bye'})
	}catch(error){
		next(error);
	}
});

/**
 * OIDC login start: create a PKCE + state challenge, persist it (auto-expiring
 * via OidcState TTL), and redirect the browser to the SSO authorize endpoint.
 */
router.get('/oidc/start', authLimiter, async function(req, res, next){
	try{
		if(!conf.oidc || !conf.oidc.enabled){
			let error = new Error('OidcDisabled');
			error.status = 404;
			error.message = 'OIDC login is not enabled.';
			throw error;
		}

		let {state, codeVerifier, codeChallenge} = oidc.createAuthRequest();
		await OidcState.create({
			state,
			codeVerifier,
			// Sanitize now so a hostile ?redirect= can't be stored and later
			// reflected into the login page's navigation.
			redirect: safeInternalPath(req.query.redirect || '/'),
		});

		return res.redirect(oidc.buildAuthUrl(state, codeChallenge));
	}catch(error){
		next(error);
	}
});

/**
 * OIDC callback: validate state (consuming the one-time record), exchange the
 * code for tokens, read identity from userinfo, establish a session, and hand
 * the app token back to the browser via a URL fragment for the login page to
 * store in localStorage.
 */
router.get('/oidc/callback', authLimiter, async function(req, res, next){
	try{
		let {code, state} = req.query;
		if(!code || !state){
			let error = new Error('OidcCallbackInvalid');
			error.status = 400;
			error.message = 'Missing code or state.';
			throw error;
		}

		// get() throws if the state is unknown or has expired — this both binds
		// the callback to our request and bounds replay.
		let saved = await OidcState.get(state);
		await saved.remove();

		let tokens = await oidc.exchangeCode(code, saved.codeVerifier);
		let claims = await oidc.fetchUserInfo(tokens.access_token);
		let identity = oidc.claimsToIdentity(claims);

		let {token} = await Auth.oidcSession(identity);

		let redirect = safeInternalPath(saved.redirect || '/');
		return res.redirect(
			`/login#token=${encodeURIComponent(token.token)}&redirect=${encodeURIComponent(redirect)}`
		);
	}catch(error){
		next(error);
	}
});

module.exports = router;
