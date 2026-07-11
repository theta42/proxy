'use strict';

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const {Host, Domain, User} = require('../models').models;
const {LocalGroup} = require('../models/local_group');
const {Permission} = require('../models/permission');
const authz = require('../middleware/authz');
const {normalizeHostFeatures} = require('../utils/host_features');
const {collectHostFieldErrors} = require('../utils/hostname_validate');
const {hashBasicAuthUsers} = require('../utils/basicauth');

const Model = Host;

// Reject a malformed host/target before it reaches the model. Throws a 422
// ObjectValidateError (per-field keys) that the frontend surfaces inline.
function validateHostFields(body){
	let errors = collectHostFieldErrors(body);
	if(errors.length) throw Model.errors.ObjectValidateError(errors);
}

// After normalizeHostFeatures has parsed basic-auth creds to {user: plaintext},
// hash them so plaintext never reaches Redis. Runs at the route layer only, so
// internally-copied records (cache/wildcard children) keep their existing hashes.
function hashHostSecrets(body){
	if(body.basicauth_users && typeof body.basicauth_users === 'object'){
		body.basicauth_users = hashBasicAuthUsers(body.basicauth_users);
	}
}

// Autocomplete source for the per-host auth allow-lists (SSO users/groups).
// Available to any authenticated host editor (not just global admins). Groups
// are derived from local groups, existing permission group-subjects, and the
// conf.auth admin/role-map groups.
router.get('/auth-suggestions', async function(req, res, next){
	try{
		let users = [];
		try{ users = (await User.list()) || []; }catch(error){ /* none */ }

		let groups = new Set();
		try{ for(let g of await LocalGroup.list()) groups.add(g); }catch(error){ /* none */ }
		try{
			for(let p of await Permission.listDetail()){
				if(p.subjectType === 'group' && p.subject) groups.add(p.subject);
			}
		}catch(error){ /* none */ }
		for(let g of (conf.auth && conf.auth.adminGroups) || []) groups.add(g);
		for(let g of Object.keys((conf.auth && conf.auth.groupRoleMap) || {})) groups.add(g);

		return res.json({users, groups: [...groups].sort()});
	}catch(error){
		return next(error);
	}
});

router.get('/', async function(req, res, next){
	try{
		let results = await Model[req.query.detail ? "listDetail" : "list"]();

		// Restrict to hosts whose domain the caller may view. list() yields host
		// strings; listDetail() yields instances with a .host.
		results = await authz.filterViewable(req, results,
			item => (typeof item === 'string' ? item : item.host));

		return res.json({results});
	}catch(error){
		return next(error);
	}
});

router.post('/', authz.requireDomainRole('manager', authz.resolve.hostBody), async function(req, res, next){
	try{
		req.body.created_by = authz.reqUsername(req);
		validateHostFields(req.body);
		normalizeHostFeatures(req.body);
		hashHostSecrets(req.body);
		let item = await Model.create(req.body);

		return res.json({
			message: `"${item[Model._key]}" added.`,
			...item,
		});
	} catch (error){
		next(error);
	}
});

router.get('/lookup/:item', authz.requireDomainRole('viewer', authz.resolve.hostParam), async function(req, res, next){
	try{
		return res.json({
			string: req.params.item,
			results: await Model.lookUp(req.params.item),
		});

	}catch(error){
		return next(error);
	}
});

// The full lookup tree exposes every host, so restrict it to admins.
router.get('/lookupobj', authz.requireAdmin, async function(req, res, next){
	try{
		return res.json({
			results: Model.lookUpObj,
		});

	}catch(error){
		return next(error);
	}
});

router.delete('/cache', authz.requireAdmin, async function(req, res, next){
	try{
		let count = await Model.clearCache();

		return res.json({
			message: `Cleared ${count} cached host${count === 1 ? '' : 's'}.`,
			count,
		});
	}catch(error){
		return next(error);
	}
});

router.get('/:item', authz.requireDomainRole('viewer', authz.resolve.hostParam), async function(req, res, next){
	try{

		return res.json({
			item: req.params.item,
			results: await Model.get(req.params.item)
		});
	}catch(error){
		return next(error);
	}
});

router.put('/:item', authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		req.body.updated_by = authz.reqUsername(req);
		validateHostFields(req.body);
		normalizeHostFeatures(req.body);
		hashHostSecrets(req.body);
		let item = await Model.get(req.params.item);
		item = await item.update(req.body);

		return res.json({
			message: `"${req.params.item}" updated.`,
			__requestedHost: req.params.item,
			...item,
		});

	}catch(error){
		return next(error);

	}
});

router.delete('/:item', authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		let count = await item.remove();

		return res.json({
			message: `${req.params.item} deleted`,
			...item,
		});

	}catch(error){
		return next(error);
	}
});

router.put('/:item/renew', authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		item.createWildcardCert();

		return res.json({
			message: `Requesting wildcard cert for ${req.params.item}`,
		})
	}catch(error){
		next(error);
	}
});

module.exports = router;
