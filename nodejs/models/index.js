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
require('./local_group');
require('./permission');
require('./oidc_state');
require('./sso_session');
require('./api_token');
