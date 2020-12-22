'use strict';

var express = require('express');
var router = express.Router();
const {Host} = require('../models/host');


/* GET home page. */
router.get('/', async function(req, res, next) {
  res.render('hosts', {});
});

/* GET home page. */
router.get('/hosts', function(req, res, next) {
  res.render('hosts', {});
});

/* GET home page. */
router.get('/users', function(req, res, next) {
  res.render('users', {});
});

/* GET home page. */
router.get('/login', function(req, res, next) {
  res.render('login', {redirect: req.query.redirect});
});

router.get('/lookup/:host', async function(req, res, next){
	try{
		return res.json({
			string: req.params.host,
			results: await Host.lookUp(req.params.host),
		});

	}catch(error){
		return next(error);
	}
});

module.exports = router;
