'use strict';

const router = require('express').Router();
const {Grant} = require('../models/grant');
const {reqUsername} = require('../middleware/authz');

// All grant management is admin-only; the gate is applied where this router is
// mounted (routes/api.js).

router.get('/', async function(req, res, next){
	try{
		return res.json({results: await Grant.listDetail()});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = reqUsername(req);
		let grant = await Grant.create(req.body);
		return res.json({
			message: `Granted ${req.body.role} to ${req.body.subjectType} "${req.body.subject}"` +
				(req.body.scope === 'global' ? ' globally.' : ` on ${req.body.domain}.`),
			...grant,
		});
	}catch(error){
		next(error);
	}
});

router.delete('/:id', async function(req, res, next){
	try{
		let grant = await Grant.get(req.params.id);
		await grant.remove();
		return res.json({message: `Grant ${req.params.id} removed.`});
	}catch(error){
		next(error);
	}
});

module.exports = router;
