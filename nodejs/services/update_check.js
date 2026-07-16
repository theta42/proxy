'use strict';

const conf = require('@simpleworkjs/conf');
const updateCheck = require('../utils/update_check');

function updateCheckService(){
	/**
	* Update Check Service
	*
	* Periodically asks GitHub for the latest published release of this repo
	* and compares it to the running version (nodejs/package.json). Never
	* auto-updates anything -- just makes the result available via
	* GET /api/update-check (see routes/update_check.js) so the admin UI can
	* show a banner when a newer release exists.
	*/

	setTimeout(updateCheck.checkNow, conf.service.updateCheck.initial);
	setInterval(updateCheck.checkNow, conf.service.updateCheck.interval);

	console.log('Update check service initialized');
	console.log(`- Checking ${updateCheck.REPO} releases: 30s after start, then every 24h`);
}

if(conf.service.updateCheck.enabled !== false) updateCheckService();

module.exports = {};
