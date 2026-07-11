'use strict';

const router = require('express').Router();
const {DnsProvider, Domain, DynamicRecord} = require('../models').models;
const authz = require('../middleware/authz');
const {Grant} = require('../models/grant');
const {getPublicIp} = require('../utils/public_ip');

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

// ---- Dynamic DNS: A records kept pointed at this box's public (WAN) IP ----
// Registered before the '/:item' provider routes so '/dynamic' isn't captured.

// Current public IP, for the UI to display.
router.get('/dynamic/ip', async function(req, res, next){
	try{
		return res.json({ip: await getPublicIp()});
	}catch(error){
		return next(error);
	}
});

// List dynamic records the caller may view (own/granted domains, or all for admin).
router.get('/dynamic', async function(req, res, next){
	try{
		let results = await DynamicRecord.listDetail();
		results = await authz.filterViewable(req, results, r => r.domain);
		return res.json({results});
	}catch(error){
		return next(error);
	}
});

// Create a record (manager on its domain), then apply it immediately.
router.post('/dynamic', authz.requireDomainRole('manager', req => req.body.domain), async function(req, res, next){
	try{
		req.body.created_by = authz.reqUsername(req);
		let item = await DynamicRecord.create(req.body);

		// Point it at the current IP now rather than waiting for the next cycle.
		// apply() swallows its own errors (recorded in last_status).
		try{ await item.apply(await getPublicIp()); }catch(error){ /* scheduler will retry */ }

		let record = await DynamicRecord.get(item.id);
		return res.json({message: `"${record.fqdn()}" added.`, ...record});
	}catch(error){
		return next(error);
	}
});

// Force an immediate refresh of one record (manager on its domain).
router.post('/dynamic/:id/refresh', async function(req, res, next){
	try{
		let record = await DynamicRecord.get(req.params.id);
		let effective = await authz.getEffective(req);
		if(!Grant.allows(effective, 'manager', authz.toDomain(record.domain))){
			let error = new Error('Forbidden'); error.name = 'Forbidden'; error.status = 403;
			error.message = `You need 'manager' rights on ${record.domain}.`;
			throw error;
		}
		let result = await record.apply(await getPublicIp());
		return res.json({message: `Refreshed "${record.fqdn()}".`, result});
	}catch(error){
		return next(error);
	}
});

// Stop managing a record (manager on its domain). Leaves the provider A record
// in place at its last value.
router.delete('/dynamic/:id', async function(req, res, next){
	try{
		let record = await DynamicRecord.get(req.params.id);
		let effective = await authz.getEffective(req);
		if(!Grant.allows(effective, 'manager', authz.toDomain(record.domain))){
			let error = new Error('Forbidden'); error.name = 'Forbidden'; error.status = 403;
			error.message = `You need 'manager' rights on ${record.domain}.`;
			throw error;
		}
		await record.remove();
		return res.json({message: `${record.fqdn()} removed.`, ...record});
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
