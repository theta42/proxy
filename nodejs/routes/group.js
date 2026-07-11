'use strict';

const router = require('express').Router();
const {LocalGroup} = require('../models/local_group');
const {reqUsername} = require('../middleware/authz');

// Local-group management is admin-only; the gate is applied where this router is
// mounted (routes/api.js).

router.get('/', async function(req, res, next){
	try{
		return res.json({results: await LocalGroup.listDetail()});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		let group = await LocalGroup.create({
			name: req.body.name,
			members: Array.isArray(req.body.members) ? req.body.members : [],
			created_by: reqUsername(req),
		});
		return res.json({message: `Group "${group.name}" created.`, ...group});
	}catch(error){
		next(error);
	}
});

router.delete('/:name', async function(req, res, next){
	try{
		let group = await LocalGroup.get(req.params.name);
		await group.remove();
		return res.json({message: `Group "${req.params.name}" removed.`});
	}catch(error){
		next(error);
	}
});

router.post('/:name/members', async function(req, res, next){
	try{
		let group = await LocalGroup.get(req.params.name);
		group = await group.addMember(req.body.username);
		return res.json({message: `Added "${req.body.username}" to "${group.name}".`, ...group});
	}catch(error){
		next(error);
	}
});

router.delete('/:name/members/:username', async function(req, res, next){
	try{
		let group = await LocalGroup.get(req.params.name);
		group = await group.removeMember(req.params.username);
		return res.json({message: `Removed "${req.params.username}" from "${group.name}".`, ...group});
	}catch(error){
		next(error);
	}
});

module.exports = router;
