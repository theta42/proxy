'use strict';

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const {Permission} = require('../models/permission');
const {LocalGroup} = require('../models/local_group');
const {User} = require('../models').models;
const {reqUsername} = require('../middleware/authz');

// All permission management is admin-only; the gate is applied where this router
// is mounted (routes/api.js).

router.get('/', async function(req, res, next){
	try{
		return res.json({results: await Permission.listDetail()});
	}catch(error){
		next(error);
	}
});

// Autocomplete source for the "Subject" field: known usernames and group names.
// Groups are derived (no group registry beyond local groups): local groups +
// group-subjects already used in permissions + conf.auth admin/role-map groups.
router.get('/subjects', async function(req, res, next){
	try{
		let users = (await User.list()) || [];

		let groups = new Set();
		try{
			for(let g of await LocalGroup.list()) groups.add(g);
		}catch(error){ /* none */ }
		try{
			for(let p of await Permission.listDetail()){
				if(p.subjectType === 'group' && p.subject) groups.add(p.subject);
			}
		}catch(error){ /* none */ }
		for(let g of (conf.auth && conf.auth.adminGroups) || []) groups.add(g);
		for(let g of Object.keys((conf.auth && conf.auth.groupRoleMap) || {})) groups.add(g);

		return res.json({users, groups: [...groups].sort()});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = reqUsername(req);
		let permission = await Permission.create(req.body);
		return res.json({
			message: `Granted ${req.body.role} to ${req.body.subjectType} "${req.body.subject}"` +
				(req.body.scope === 'global' ? ' globally.' : ` on ${req.body.domain}.`),
			...permission,
		});
	}catch(error){
		next(error);
	}
});

// Edit an existing grant.
//
// The record id is derived from (subjectType, subject, scope, domain)
// -- Permission.mkId -- so changing any of those is a DIFFERENT record, not an
// in-place update. Changing only the role is a true update. Handle both here so
// the UI can offer a single "edit" instead of making the operator delete and
// re-add, and so a subject/scope change can never leave the old grant behind
// still conferring access.
router.put('/:id', async function(req, res, next){
	try{
		let existing = await Permission.get(req.params.id);
		if(!existing) return res.status(404).json({message: `Permission ${req.params.id} not found.`});

		let next_ = {
			subjectType: req.body.subjectType !== undefined ? req.body.subjectType : existing.subjectType,
			subject:     req.body.subject     !== undefined ? req.body.subject     : existing.subject,
			scope:       req.body.scope       !== undefined ? req.body.scope       : existing.scope,
			domain:      req.body.domain      !== undefined ? req.body.domain      : existing.domain,
			role:        req.body.role        !== undefined ? req.body.role        : existing.role,
			created_by:  reqUsername(req),
		};
		if(next_.scope === 'global') next_.domain = '*';

		// create() upserts on the new id, so this is safe in either direction;
		// remove the old record afterwards only when the identity actually moved.
		let permission = await Permission.create(next_);
		let newId = Permission.mkId(next_);
		if(newId !== req.params.id){
			try{ await existing.remove(); }catch(error){ /* already replaced */ }
		}

		return res.json({
			message: `Updated ${next_.subjectType} "${next_.subject}" to ${next_.role}` +
				(next_.scope === 'global' ? ' globally.' : ` on ${next_.domain}.`),
			...permission,
		});
	}catch(error){
		next(error);
	}
});

router.delete('/:id', async function(req, res, next){
	try{
		let permission = await Permission.get(req.params.id);
		await permission.remove();
		return res.json({message: `Permission ${req.params.id} removed.`});
	}catch(error){
		next(error);
	}
});

module.exports = router;
