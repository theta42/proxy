'use strict';

const conf = require('../conf');

const User = require(`./user_${conf.userModel}`)

module.exports = User;
