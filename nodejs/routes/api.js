'use strict';

const router = require('express').Router();
const conf = require('@simpleworkjs/conf');
const middleware = require('../middleware/auth');

// API routes for authentication. 
router.use('/auth',  require('./auth'));

// API routes for working with users. All endpoints need to be have valid user.
router.use('/user', middleware.auth, require('./user'));

// API routes for working with hosts. All endpoints need to be have valid user.
router.use('/host', middleware.auth, require('./host'));

router.use('/dns', middleware.auth, require('./dns'));

// API routes for working with hosts. All endpoints need to be have valid user.
router.use('/cert', middleware.auth, require('./cert'));

module.exports = router;