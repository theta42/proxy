'use strict';

const router = require('express').Router();
const {rateLimit} = require('express-rate-limit');
const conf = require('@simpleworkjs/conf');
const {Host, Domain, User} = require('../models').models;
const {LocalGroup} = require('../models/local_group');
const {Permission} = require('../models/permission');
const authz = require('../middleware/authz');
const {normalizeHostFeatures, sanitizeBasicAuthObject} = require('../utils/host_features');
const {collectHostFieldErrors} = require('../utils/hostname_validate');
const {hashBasicAuthUsers} = require('../utils/basicauth');

const Model = Host;

// Throttle host-mutating endpoints (create/update/delete a host, manage a
// basic-auth user's password) per IP. These already require an authenticated,
// authorized manager/admin, but a compromised or careless session shouldn't
// be able to hammer them unboundedly — same pattern as routes/auth.js's
// authLimiter, just a higher ceiling since legitimate admin work (bulk edits)
// is expected here.
const mutateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,   // 15 minutes
	max: 300,                   // 300 mutations per IP per window
	standardHeaders: true,
	legacyHeaders: false,
	message: {name: 'TooManyRequests', message: 'Too many requests, please try again later.'},
});

// Reject a malformed host/target before it reaches the model. Throws a 422
// ObjectValidateError (per-field keys) that the frontend surfaces inline.
function validateHostFields(body){
	let errors = collectHostFieldErrors(body);
	if(errors.length) throw new Model.errors.ObjectValidateError(errors);
}

// Basic auth and SSO are mutually exclusive per host (having both enabled
// invites confusion about which gate actually protected a request). `existing`
// is the current record (undefined on create), so a partial PUT that only
// touches one of the two fields is still checked against the other's current
// value.
function validateAuthExclusivity(body, existing){
	let basic = 'basicauth_enabled' in body ? body.basicauth_enabled : (existing ? existing.basicauth_enabled : false);
	let sso = 'sso_enabled' in body ? body.sso_enabled : (existing ? existing.sso_enabled : false);
	if(basic && sso){
		throw new Model.errors.ObjectValidateError([
			{key: 'sso_enabled', message: 'Basic auth and SSO cannot both be enabled for the same host — pick one.'},
		]);
	}
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

router.post('/', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostBody), async function(req, res, next){
	try{
		req.body.created_by = authz.reqUsername(req);
		validateHostFields(req.body);
		normalizeHostFeatures(req.body);
		validateAuthExclusivity(req.body);
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

// Is there a wildcard host that could serve as :item's parent (i.e. an
// already-issued cert :item could reuse instead of getting its own)? Two
// cases, covered by two different lookups: a brand-new subdomain that has
// never been created (lookUp()'s normal wildcard fallback finds it, since
// the name has no leaf of its own yet), and an ALREADY-EXISTING host or the
// wildcard's own base domain (lookUp() would just resolve to that host's
// own leaf -- lookUpWildcardParent() checks the sibling "*" slot instead;
// see its comment in models/host.js). Used by the host create/edit form to
// decide whether to offer "Parent Wildcard" as a challenge type.
router.get('/wildcard-parent/:item', authz.requireDomainRole('viewer', authz.resolve.hostParam), async function(req, res, next){
	try{
		let match = Model.lookUp(req.params.item);
		if(!match || !match.is_wildcard){
			match = Model.lookUpWildcardParent(req.params.item);
		}
		return res.json({
			results: (match && match.is_wildcard) ? match : null,
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

router.delete('/cache', mutateLimiter, authz.requireAdmin, async function(req, res, next){
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

router.put('/:item', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		req.body.updated_by = authz.reqUsername(req);
		validateHostFields(req.body);
		normalizeHostFeatures(req.body);
		let existing = await Model.get(req.params.item);
		validateAuthExclusivity(req.body, existing);
		hashHostSecrets(req.body);
		let item = await existing.update(req.body);

		return res.json({
			message: `"${req.params.item}" updated.`,
			__requestedHost: req.params.item,
			...item,
		});

	}catch(error){
		return next(error);

	}
});

router.delete('/:item', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
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

// Manage a single basic-auth user without replacing the whole list — the bulk
// PUT /:item endpoint always replaces basicauth_users wholesale (an empty
// textarea there means "leave existing users untouched", see
// normalizeHostFeatures), which makes deleting or rotating one user's
// password error-prone from that form. These two routes touch exactly one key.
router.put('/:item/basicauth-user/:username', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		let sanitized = sanitizeBasicAuthObject({[req.params.username]: req.body.password});
		let username = Object.keys(sanitized)[0];
		if(!username){
			throw new Model.errors.ObjectValidateError([{key: 'password', message: 'Invalid username or empty password.'}]);
		}

		let users = Object.assign({}, item.basicauth_users, hashBasicAuthUsers(sanitized));
		item = await item.update({basicauth_users: users, updated_by: authz.reqUsername(req)});

		return res.json({message: `User "${username}" saved.`, ...item});
	}catch(error){
		next(error);
	}
});

router.delete('/:item/basicauth-user/:username', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		let users = Object.assign({}, item.basicauth_users);
		delete users[req.params.username];
		item = await item.update({basicauth_users: users, updated_by: authz.reqUsername(req)});

		return res.json({message: `User "${req.params.username}" removed.`, ...item});
	}catch(error){
		next(error);
	}
});

router.put('/:item/renew', mutateLimiter, authz.requireDomainRole('manager', authz.resolve.hostParam), async function(req, res, next){
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
