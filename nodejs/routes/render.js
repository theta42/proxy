'use strict';

const path = require('path');
const express = require('express');
const router = require('express').Router();
const conf = require('../conf');

const values ={
  title: conf.environment !== 'production' ? `dev` : '',
  titleIcon: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : '',
}

// List of front end node modules to be served
const frontEndModules = ['bootstrap', 'mustache', 'jquery', '@fortawesome',
  'moment', '@popper',
];

// Server front end modules
// https://stackoverflow.com/a/55700773/3140931
frontEndModules.forEach(dep => {
  router.use(`/static-modules/${dep}`, express.static(path.join(__dirname, `../node_modules/${dep}`)))
});

// Have express server static content( images, CSS, browser JS) from the public
// local folder.
router.use('/static', express.static(path.join(__dirname, '../public')))

router.get('/', async function(req, res, next) {
  res.render('hosts', {...values});
});

router.get('/hosts', async function(req, res, next) {
  res.render('hosts', {...values});
});

router.get('/cert', async function(req, res, next) {
  res.render('cert', {...values});
});

router.get('/dns', async function(req, res, next) {
  res.render('dns', {...values});
});

router.get('/users', async function(req, res, next) {
  res.render('users', {...values});
});

router.get('/login*', async function(req, res, next) {
  res.render('login', {...values, redirect: req.query.redirect});
});

router.get('/test', async function(req, res, next) {
  res.render('test', {...values, redirect: req.query.redirect});
});
module.exports = router;
