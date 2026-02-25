'use strict';
const conf = require('@simpleworkjs/conf');
const {setUpTable} = require('model-redis');

const Table = setUpTable(conf.redis);

module.exports = Table;

require('./dns_provider');
require('./host');
require('./token');
require('./user');
