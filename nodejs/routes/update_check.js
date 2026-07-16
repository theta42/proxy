'use strict';

const router = require('express').Router();
const updateCheck = require('../utils/update_check');

// Any authenticated user can read this (it's just "is a newer version
// published on GitHub", not sensitive) -- the UI only shows the banner to
// admins (see views/top.ejs), but the endpoint itself doesn't need to be
// admin-gated.
router.get('/', async function(req, res, next){
	try{
		return res.json(updateCheck.getState());
	}catch(error){
		next(error);
	}
});

module.exports = router;
