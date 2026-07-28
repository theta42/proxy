'use strict';

const path = require('path');
const express = require('express');
const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const buildInfo = require('../utils/build_info');
const { mountStaticModules } = require('@simpleworkjs/app-stack');

const values ={
  title: conf.environment !== 'production' ? `dev` : '',
  titleIcon: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : '',
  name: conf.name,
  logo: conf.logo,
  ...buildInfo,
}

// List of front end node modules to be served
// Vendor libraries only change when package versions are bumped (a rebuild),
// so they're safe to cache aggressively; ETag/Last-Modified (on by default)
// still cover that rare case with a cheap 304 instead of a stale asset. The
// app's own JS/CSS/img from public/ gets a shorter maxAge since it changes on
// every deploy and isn't cache-busted/fingerprinted.
mountStaticModules(router, {
  root: path.join(__dirname, '..'),
  deps: ['bootstrap', 'mustache', 'jquery', '@fortawesome', 'moment', '@popper', 'jq-repeat', '@simpleworkjs/frontend'],
});

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

// Linkable deep-link to a single host's modal, e.g. from the host modal's
// app.modal `url` option. No server-side use of :host -- the client reads
// location.pathname itself and opens the matching host's modal once the
// page's own data has loaded (same idiom sso-manager-node uses for
// /directory/:slug).
router.get('/hosts/:host', async function(req, res, next) {
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

module.exports = router;
