'use strict';

const router = require('express').Router();
const {getCert} = require('../models/cert');


router.get('/:host', async function(req, res, next){
	try{
		return res.json(await getCert(req.params.host));
	}catch(error){
		return next(error);
	}
});

module.exports = router;
