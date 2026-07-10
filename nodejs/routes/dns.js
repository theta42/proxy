'use strict';

const router = require('express').Router();
const {DnsProvider, Domain} = require('../models').models;
const authz = require('../middleware/authz');

const Model = DnsProvider;

// Provider listing exposes credentials/config for every domain, so it is
// admin-only. The creator of a provider still owns its domains (via created_by)
// and manages hosts/records under them without being a global admin.
router.get('/', authz.requireAdmin, async function(req, res, next){
	try{
		return res.json({
			results:  await Model[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		return next(error);
	}
});

router.options('/', authz.requireAdmin, async function(req, res, next){
	try{
		return res.json({
			results:  await Model.listProviders()
		});
	}catch(error){
		return next(error);
	}
});

router.post('/', authz.requireAdmin, async function(req, res, next){
	try{
		req.body.created_by = authz.reqUsername(req);
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
		let results = await Domain[req.query.detail ? "listDetail" : "list"]();

		// Only surface domains the caller may view.
		results = await authz.filterViewable(req, results,
			item => (typeof item === 'string' ? item : item.domain));

		return res.json({results});
	}catch(error){
		return next(error);
	}
});

router.post('/domain/refresh/:item', authz.requireAdmin, async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		return res.json({results: await item.updateDomains()});
	}catch(error){
		next(error);
	}
})

router.get('/domain/:item', authz.requireDomainRole('viewer', authz.resolve.domainParam), async function(req, res, next){
	try{
		return res.json({
			results:  [await Domain.get(req.params.item)]
		});
	}catch(error){
		return next(error);
	}
});

router.get('/:item', authz.requireAdmin, async function(req, res, next){
	try{

		return res.json({
			item: req.params.item,
			results: await Model.get(req.params.item)
		});
	}catch(error){
		return next(error);
	}
});

router.put('/:item', authz.requireAdmin, async function(req, res, next){
	try{
		req.body.updated_by = authz.reqUsername(req);
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

router.delete('/:item', authz.requireAdmin, async function(req, res, next){
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

module.exports = router;
