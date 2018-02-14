const client = require('../redis');
const router = require('express').Router();
const app = require('../app');

router.get('/:host', async function(req, res){
	client.HGETALL('host_' + req.params.host, function (error, results) {
		res.json({
			host: req.params.host,
			results: results
		});
	});
});

router.get('/', async function(req, res){
	client.SMEMBERS('hosts', function(error, results){
		if(error){
			return res.status(500).json({message: `ERROR ${error}`});
		}
		return res.json({hosts: results});
	});
});

router.post('/', async function(req, res){
	let ip = req.body.ip;
	let host = req.body.host;

	if(!host || !ip){
		return res.status(400).json({
			message: `Missing fields: ${!host ? 'host' : ''} ${!ip ? 'ip' : ''}` 
		});
	}else{

		try{
			await client.SADD('hosts', host);
			await client.HSET('host_' + host, 'ip', ip);
			await client.HSET('host_' + host, 'updated', (new Date).getTime());

		} catch (error){
			return res.status(500).json({
				message: `ERROR: ${error}`
			});
		}

		return res.json({
			message: `Host ${host} Added`
		});
	}
});

router.delete('/', async function(req, res){
	let host = req.body.host;

	if(!host){
		return res.status(400).json({
			message: `Missing fields: ${!host ? 'host' : ''}` 
		});
	}else{
	
		try{
			await client.SREM('hosts', host);
			await client.DEL('host_' + host);
		}catch(error){
			return res.status(500).json({
				message: `ERROR: ${error}`
			});
		}

		return res.json({
			message: `Host ${host} deleted`
		});
	}
});

module.exports = router;
