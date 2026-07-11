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
