'use strict';

const router = require('express').Router();
const {Host} = require('../models/host');


const Model = Host;

router.get('/', async function(req, res, next){
	try{
		return res.json({
			hosts:  await Model[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		return next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = req.user.username;
		let item = await Model.add(req.body);

		return res.json({
			message: `"${item[Model._key]}" added.`
		});
	} catch (error){
		return next(error);
	}
});

router.get('/:item(*)', async function(req, res, next){
	try{

		return res.json({
			item: req.params.item,
			results: await Model.get(req.params.item)
		});
	}catch(error){
		return next(error);
	}
});

router.put('/:item(*)', async function(req, res, next){
	try{
		req.body.updated_by = req.user.username;
		let item = await Model.get(req.params.item);
		await item.update(req.body);

		return res.json({
			message: `"${req.params.item}" updated.`
		});

	}catch(error){
		return next(error);

	}
});

router.delete('/:item(*)', async function(req, res, next){
	try{
		let item = await Model.get(req.params.item);
		let count = await item.remove();

		return res.json({
			message: `${req.params.item} deleted`,
		});

	}catch(error){
		return next(error);
	}
});

router.get('/lookup/:item(*)', async function(req, res, next){
	try{
		return res.json({
			string: req.params.item,
			results: await Model.lookUp(req.params.item),
		});

	}catch(error){
		return next(error);
	}
});

module.exports = router;
