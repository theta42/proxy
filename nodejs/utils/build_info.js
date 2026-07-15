'use strict';

const { execSync } = require('child_process');
const { version: buildVersion } = require('../package.json');

let buildHash = 'unknown';
try {
	buildHash = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
} catch (_) {}

module.exports = {
	buildVersion,
	buildHash,
	buildYear: new Date().getFullYear(),
};
