'use strict';

const path = require('path');
const express = require('express');
const router = require('express').Router();
const conf = require('@simpleworkjs/conf');

const values ={
  title: conf.environment !== 'production' ? `dev` : '',
  titleIcon: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : '',
}

// List of front end node modules to be served
const frontEndModules = ['bootstrap', 'mustache', 'jquery', '@fortawesome',
  'moment', '@popper', 'jq-repeat',
];

// Server front end modules
// https://stackoverflow.com/a/55700773/3140931
frontEndModules.forEach(dep => {
  router.use(`/static-modules/${dep}`, express.static(path.join(__dirname, `../node_modules/${dep}`)))
});

// Have express server static content( images, CSS, browser JS) from the public
// local folder.
router.use('/static', express.static(path.join(__dirname, '../public')))

router.get('/', (req, res) => {
  res.redirect(301, '/hosts');
});

router.get('/hosts', async function(req, res, next) {
  res.render('hosts', {...values});
});

router.get('/dns', async function(req, res, next) {
  res.render('dns', {...values});
});


router.get('/users', async function(req, res, next) {
  res.render('users', {...values});
});

router.get('/permissions', async function(req, res, next) {
  res.render('permissions', {...values});
});

router.get('/groups', async function(req, res, next) {
  res.render('groups', {...values});
});

router.get('/profile', async function(req, res, next) {
  res.render('profile', {...values});
});

// Bare /login (the OIDC callback redirect target) and /login/<path>.
router.get('/login', async function(req, res, next) {
  res.render('login', {...values, redirect: req.query.redirect});
});

router.get('/login/*splat', async function(req, res, next) {
  res.render('login', {...values, redirect: req.query.redirect});
});

router.get('/test', async function(req, res, next) {
  res.render('test', {...values, redirect: req.query.redirect});
});
module.exports = router;
