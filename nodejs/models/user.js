'use strict';

const conf = require('@simpleworkjs/conf');

const User = require(`./user_${conf.userModel}`)

module.exports = User;
