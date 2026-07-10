'use strict';

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const middleware = require('../middleware/auth');
const authz = require('../middleware/authz');

// API routes for authentication.
router.use('/auth',  require('./auth'));

// API routes for working with users. All endpoints need to be have valid user.
// User management is admin-only; the router allows self-service exceptions
// (GET /me, PUT /password) before its own admin gate.
router.use('/user', middleware.auth, require('./user'));

// API routes for working with hosts. All endpoints need to be have valid user.
// Per-domain authorization is enforced inside the host router.
router.use('/host', middleware.auth, require('./host'));

router.use('/dns', middleware.auth, require('./dns'));

// API routes for working with hosts. All endpoints need to be have valid user.
router.use('/cert', middleware.auth, require('./cert'));

// Grant management (who can manage which domains) is global-admin-only.
router.use('/grant', middleware.auth, authz.requireAdmin, require('./grant'));

module.exports = router;