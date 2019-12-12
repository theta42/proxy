'use strict';

const router = require('express').Router();

const Host = require('../models/hosts');

router.get('/:host', async function(req, res){
	let host = req.params.host;

	let info = await Host.getInfo({host});

	return res.status(info ? 200 : 404).json({
		host: req.params.host,
		results: info
	});
});

router.get('/', async function(req, res){
	try{
		return res.json({
			hosts: req.query.detail ? await host.listAllDetail() : await Host.listAll()
		});
	}catch(error){
		return res.status(500).json({message: `ERROR ${error}`});
	}
});

router.post('/', async function(req, res){
	let ip = req.body.ip;
	let host = req.body.host;
	let targetPort = req.body.targetPort;

	if(!host || !ip || !targetPort ){
		return res.status(400).json({
			message: `Missing fields: ${!host ? 'host' : ''} ${!ip ? 'ip' : ''} ${!targetPort ? 'targetPort' : ''}` 
		});
	}

	try{
		await Host.add({
			host, ip, targetPort,
			username: req.user.username,
			forceSSL: req.body.forceSSL,
			targetSSL: req.body.targetSSL,
		});

		return res.json({
			message: `Host ${host} Added`
		});
	} catch (error){

		return res.status(500).json({
			message: `ERROR: ${error}`
		});
	}

});

router.delete('/:host', async function(req, res, next){
	let host = req.params.host;
	
	try{
		let count = await Host.remove({host});

		return res.json({
			message: `Host ${host} deleted`,
		});

	}catch(error){
		return res.status(500).json({
			message: `ERROR: ${error}`
		});
	}
});

module.exports = router;
