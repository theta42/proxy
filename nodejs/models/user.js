'use strict';

const conf = require('../app').conf;

const User = require(`./user_${conf.userModel}`)

module.exports = User;
