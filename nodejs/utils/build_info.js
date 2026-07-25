'use strict';

// Unified build-info shape ({ buildVersion, buildHash, buildYear }) via the
// shared @simpleworkjs/app-stack. The baked commit file lives at nodejs/.build_commit
// (../ from here in utils/), matching the Dockerfile gitinfo stage; cwd is
// utils/ for the bare-metal git fallback.

const path = require('path');
const { createBuildInfo } = require('@simpleworkjs/app-stack');
const { version } = require('../package.json');

module.exports = createBuildInfo({
	version,
	buildCommitPath: path.join(__dirname, '../.build_commit'),
	cwd: __dirname,
});