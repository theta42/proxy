'use strict';

const router = require('express').Router();
const {DnsProvider, Domain} = require('../models/dnsProvider');

const Model = DnsProvider;

router.get('/', async function(req, res, next){
	try{
		return res.json({
			results:  await Model[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		return next(error);
	}
});

router.options('/', async function(req, res, next){
	try{
		return res.json({
			results:  await Model.listProviders()
		});
	}catch(error){
		return next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = req.user.username;
		let item = await Model.create(req.body);

		return res.json({
			message: `"${item[Model._key]}" added.`,
			...item,
		});
	} catch (error){
		next(error);
	}
});

router.get('/domain', async function(req, res, next){
	try{
		return res.json({
			results:  await Domain[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		return next(error);
	}
});

router.get('/domain/byProvider/:item', async function(req, res, next){
	try{
		console.log('byProvider', req.params.item, await Domain.getByProviderId(req.params.item))
		return res.json({
			results:  await Domain.getByProviderId(req.params.item)
		});
	}catch(error){
		return next(error);
	}
});

router.post('/domain/refresh/:item', async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		item.updateDomains();
		return res.json({});
	}catch(error){
		next(error);
	}
})



router.get('/lookup/:item', async function(req, res, next){
	try{
		return res.json({
			string: req.params.item,
			results: await Model.lookUp(req.params.item),
		});

	}catch(error){
		return next(error);
	}
});

router.get('/:item', async function(req, res, next){
	try{

		return res.json({
			item: req.params.item,
			results: await Model.get(req.params.item)
		});
	}catch(error){
		return next(error);
	}
});

router.put('/:item', async function(req, res, next){
	try{
		req.body.updated_by = req.user.username;
		let item = await Model.get(req.params.item);
		item = await item.update(req.body);

		return res.json({
			message: `"${req.params.item}" updated.`,
			__requestedHost: req.params.item,
			...item,
		});

	}catch(error){
		return next(error);

	}
});

router.delete('/:item', async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		let count = await item.remove();

		return res.json({
			message: `${req.params.item} deleted`,
			...item,
		});

	}catch(error){
		return next(error);
	}
});

router.put('/:item/renew', async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		item.createWildcardCert();

		return res.json({
			message: `Requesting wildcard cert for ${req.params.item}`,
		})
	}catch(error){
		next(error);
	}
});

module.exports = router;
