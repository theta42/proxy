'use strict';

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const { Auth } = require('../models/auth');
const { OidcState } = require('../models/oidc_state');
const oidc = require('../utils/oidc');


router.post('/login', async function(req, res, next){
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
router.get('/oidc/start', async function(req, res, next){
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
			redirect: req.query.redirect || '/',
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
router.get('/oidc/callback', async function(req, res, next){
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

		let redirect = saved.redirect || '/';
		return res.redirect(
			`/login#token=${encodeURIComponent(token.token)}&redirect=${encodeURIComponent(redirect)}`
		);
	}catch(error){
		next(error);
	}
});

module.exports = router;
