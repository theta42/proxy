'use strict';

const router = require('express').Router();
const {Host} = require('../models/host');


router.get('/:host', async function(req, res, next){
	try{

		return res.json({
			host: req.params.host,
			results: await Host.get({host: req.params.host})
		});
	}catch(error){
		return next(error);
	}

});

router.get('/', async function(req, res, next){
	try{
		return res.json({
			hosts:  await Host[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		next(error)
	}
});

router.put('/:host', async function(req, res, next){
	try{
		req.body.updated_by = req.user.username;
		let host = await Host.get(req.params.host);
		await host.update(req.body);

		return res.json({
			message: `Host "${req.params.host}" updated.`
		});
	}catch(error){
		return next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = req.user.username;
		await Host.add(req.body);

		return res.json({
			message: `Host "${req.body.host}" added.`
		});
	} catch (error){
		next(error);
	}

});

router.delete('/:host', async function(req, res, next){
	
	try{
		let host = await Host.get(req.params);
		let count = await host.remove(host);

		return res.json({
			message: `Host ${req.params.host} deleted`,
		});

	}catch(error){
		next(error);
	}
});

module.exports = router;
