'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { version: buildVersion } = require('../package.json');

// Docker builds bake the commit hash into ../.build_commit (see the gitinfo
// stage in Dockerfile) -- the final image has no git binary and no .git
// directory, so `git rev-parse` below always fails there. Bare-metal/dev
// runs have no baked file, so they fall back to asking git directly.
function readBuildHash() {
	try {
		const baked = fs.readFileSync(path.join(__dirname, '../.build_commit'), 'utf8').trim();
		if (baked) return baked;
	} catch (_) {}

	try {
		return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
	} catch (_) {
		return 'unknown';
	}
}

module.exports = {
	buildVersion,
	buildHash: readBuildHash(),
	buildYear: new Date().getFullYear(),
};
