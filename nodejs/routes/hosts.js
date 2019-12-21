'use strict';

const router = require('express').Router();

const Host = require('../models/hosts');

router.get('/:host', async function(req, res, next){
	try{

		return res.json({
			host: req.params.host,
			results: await Host.getInfo({host: req.params.host})
		});
	}catch(error){
		return next(error);
	}

});

router.get('/', async function(req, res, next){
	try{
		return res.json({
			hosts: req.query.detail ? await Host.listAllDetail() : await Host.listAll()
		});
	}catch(error){
		next(error)
	}
});

router.put('/:host', async function(req, res, next){
	try{
		req.body.username = req.user.username;
		await Host.edit(req.body, req.params.host);

		return res.json({
			message: `Host "${req.params.host}" updated.`
		});
	}catch(error){
		return next(error)
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.username = req.user.username;
		await Host.add(req.body);

		return res.json({
			message: `Host "${req.body.host}" added.`
		});
	} catch (error){
		next(error)
	}

});

router.delete('/:host', async function(req, res, next){
	
	try{
		let host = req.params.host;
		let count = await Host.remove({host});

		return res.json({
			message: `Host ${req.params.host} deleted`,
		});

	}catch(error){
		return next(error)
	}
});

module.exports = router;
