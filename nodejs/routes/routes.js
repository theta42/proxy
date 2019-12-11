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
		let hosts = await Host.listAll();
		return res.json({hosts: hosts});
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
		await Host.add({host, ip, targetPort,
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

router.delete('/', async function(req, res){
	let host = req.body.host;
	let count;

	if(!host){
		return res.status(400).json({
			message: `Missing fields: ${!host ? 'host' : ''}` 
		});
	}
	
	try{
		count = await Host.remove({host});

	}catch(error){
		return res.status(500).json({
			message: `ERROR: ${error}`
		});
	}

	return res.json({
		message: `Host ${host} deleted`,
	});
});

module.exports = router;
