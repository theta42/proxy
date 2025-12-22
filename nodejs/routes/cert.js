'use strict';

const router = require('express').Router();
const {Cert} = require('../models').models;


router.get('/', async(req, res, next)=>{
	try{
		return res.json({
			results: await Cert.findall()
		});
	}catch(error){
		next(error);
	}
});

router.get('/:item', async(req, res, next)=>{
	try{
		let item = await Cert.get(req.params.item);
		return res.json({
			results: item,
		});
	}catch(error){
		next(error);
	}
});

router.get('/:item/cert/:type', async(req, res, next)=>{
	try{
		let item = await Cert.get(req.params.item);
		return res.json({
			results: await item.getPem(req.params.type),
		});
	}catch(error){
		next(error);
	}
});

router.post('/', async (req, res, next)=>{
	try{
		req.body.created_by = req.user.username;
		return res.json({
			results: await Cert.create({
				...req.body
			}),
			ok: true,
		});
	}catch(error){
		next(error);
	}
});

router.put('/:item/renew', async (req, res, next)=>{
	try{
		let item = await Cert.get(req.params.item);

		return res.json({
			results: await item.renew({
				username: req.user.username,
			}),
			message: `Renewing certificate.`,
		});
	}catch(error){
		next(error);
	}
});

router.delete('/:item', async (req, res, next)=>{
	try{
		let item = await Cert.get(req.params.item);
		return res.json({
			results: await item.remove(),
			message: `${req.params.item} has been removed`
		});
	}catch(error){
		next(error);
	}
})

module.exports = router;
