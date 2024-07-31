'use strict';

const router = require('express').Router();
const conf = require('../conf')
const middleware = require('../middleware/auth');

const values ={
  title: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : ''
}

router.get('/', async function(req, res, next) {
  res.render('hosts', {...values});
});

router.get('/hosts', async function(req, res, next) {
  res.render('hosts', {...values});
});

router.get('/users', async function(req, res, next) {
  res.render('users', {...values});
});

router.get('/login', async function(req, res, next) {
  res.render('login', {...values, redirect: req.query.redirect});
});

module.exports = router;
