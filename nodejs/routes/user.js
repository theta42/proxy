'use strict';

const router = require('express').Router();
const {User} = require('../models').models;
const authz = require('../middleware/authz');

// User management is global-admin-only, except the self-service routes below
// (GET /me, PUT /password, POST /key) which any authenticated user may call for
// their own account.

router.get('/', authz.requireAdmin, async function(req, res, next){
	try{
		return res.json({
			results:  await User[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		next(error);
	}
});

router.post('/', authz.requireAdmin, async function(req, res, next){
	try{
		req.body.created_by = authz.reqUsername(req)

		return res.json(await User.add(req.body));
	}catch(error){
		next(error);
	}
});

router.delete('/:username', authz.requireAdmin, async function(req, res, next){
	try{
		let user = await User.get(req.params.username);

		return res.json({username: req.params.username, results: await user.remove()})
	}catch(error){
		next(error);
	}
});

// Self-service: the caller's own identity and effective rights. Drives the
// frontend's nav/button gating.
router.get('/me', async function(req, res, next){
	try{
		let effective = await authz.getEffective(req);
		return res.json({
			username: authz.reqUsername(req),
			// Merged groups (external + local); localGroups is the app-managed
			// subset, externalGroups the ones from SSO/LDAP.
			groups: effective.groups || req.groups || [],
			localGroups: effective.localGroups || [],
			externalGroups: req.groups || [],
			isAdmin: effective.isAdmin,
			global: effective.global,
			domains: effective.domains,
		});
	}catch(error){
		next(error);
	}
});

// Self-service: change your own password.
router.put('/password', async function(req, res, next){
	try{
		return res.json({results: await req.user.setPassword(req.body)})
	}catch(error){
		next(error);
	}
});

// Admin: reset another user's password.
router.put('/password/:username', authz.requireAdmin, async function(req, res, next){
	try{
		let user = await User.get(req.params.username);
		return res.json({results: await user.setPassword(req.body)});
	}catch(error){
		next(error);
	}
});

router.post('/invite', authz.requireAdmin, async function(req, res, next){
	try{
		let token = await req.user.invite();

		return res.json({token: token.token});
	}catch(error){
		next(error);
	}
});

// Self-service: add an SSH key to your own account.
router.post('/key', async function(req, res, next){
	try{
		let added = await User.addSSHkey({
			username: authz.reqUsername(req),
			key: req.body.key
		});

		return res.status(added === true ? 200 : 400).json({
			message: added
		});

	}catch(error){
		next(error);
	}

});

module.exports = router;
