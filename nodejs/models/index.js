'use strict';

const Table = require('../utils/redis_model')
module.exports = Table;

require('./dns_provider');
require('./host');
require('./token');
require('./user');
