'use strict';

const {setUpTable} = require('model-redis');
const conf = require('@simpleworkjs/conf');

const Table = setUpTable({
	prefix: conf.redis.prefix
});

module.exports = Table;
