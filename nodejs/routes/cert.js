'use strict';

const router = require('express').Router();
const {getCert} = require('../models/cert');
const authz = require('../middleware/authz');


router.get('/:host', authz.requireDomainRole('viewer', req => req.params.host), async function(req, res, next){
	try{
		return res.json(await getCert(req.params.host));
	}catch(error){
		return next(error);
	}
});

module.exports = router;
