'use strict';
const conf = require('@simpleworkjs/conf');
const {setUpTable} = require('model-redis');

const Table = setUpTable(conf.redis);

module.exports = Table;

require('./dns_provider');
require('./dynamic_record');
require('./host');
require('./token');
require('./user');
require('./grant');
require('./oidc_state');
