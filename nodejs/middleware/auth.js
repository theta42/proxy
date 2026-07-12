'use strict';

const {Auth} = require('../models/auth');

async function auth(req, res, next){
	try{
		// API-only token: `Authorization: Bearer prx_<id>_<secret>`. Takes
		// precedence over the browser session header so scripts hit the same
		// /api/* routes the UI uses. The synthetic req.token below satisfies the
		// only req.token reads in the codebase: .user, .groupsArray(), .created_by
		// (see middleware/authz.js reqUsername).
		const authz = req.header('authorization') || '';
		if(authz.slice(0, 7).toLowerCase() === 'bearer '){
			const t = await Auth.checkApiToken(authz.slice(7));
			req.token = {
				user: {username: t.created_by},
				created_by: t.created_by,
				groupsArray: () => Array.isArray(t.groups) ? t.groups : [],
				check: () => true,
				is_valid: true,
			};
			req.user = req.token.user;
			req.groups = req.token.groupsArray();
			return next();
		}

		// Browser session: `auth-token: <AuthToken uuid>`.
		req.token = await Auth.checkToken(req.header('auth-token'));
		req.user = req.token.user;
		// Session group memberships captured at login, used by authz middleware.
		req.groups = typeof req.token.groupsArray === 'function' ? req.token.groupsArray() : [];
		return next();
	}catch(error){
		next(error);
	}
}

async function authIO(socket, next){
	try{
		let token = await Auth.checkToken(socket.handshake.auth.token || 0);
		socket.user = token.user;
		next();
	}catch(error){
		next(error);
	}
}

module.exports = {auth, authIO};
