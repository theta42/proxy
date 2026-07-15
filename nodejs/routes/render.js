'use strict';

const path = require('path');
const express = require('express');
const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const buildInfo = require('../utils/build_info');

const values ={
  title: conf.environment !== 'production' ? `dev` : '',
  titleIcon: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : '',
  ...buildInfo,
}

// List of front end node modules to be served
const frontEndModules = ['bootstrap', 'mustache', 'jquery', '@fortawesome',
  'moment', '@popper', 'jq-repeat',
];

// Server front end modules
// https://stackoverflow.com/a/55700773/3140931
// Vendor libraries only change when package versions are bumped (a rebuild),
// so they're safe to cache aggressively; ETag/Last-Modified (on by default)
// still cover that rare case with a cheap 304 instead of a stale asset.
frontEndModules.forEach(dep => {
  router.use(`/static-modules/${dep}`, express.static(path.join(__dirname, `../node_modules/${dep}`), {maxAge: '7d'}))
});

// Have express server static content( images, CSS, browser JS) from the public
// local folder. Shorter maxAge than /static-modules since this is the app's
// own JS/CSS, which changes on every deploy and isn't cache-busted/fingerprinted.
router.use('/static', express.static(path.join(__dirname, '../public'), {maxAge: '1h'}))

router.get('/', (req, res) => {
  res.redirect(301, '/hosts');
});

// Lightweight liveness probe for container healthchecks / monitoring. No auth,
// no dependencies — just confirms the Express process is up and routing.
router.get('/health', (req, res) => {
  res.json({status: 'ok'});
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

// API Tokens is now a section on the Profile page.
router.get('/api-tokens', (req, res) => {
  res.redirect(301, '/profile');
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
