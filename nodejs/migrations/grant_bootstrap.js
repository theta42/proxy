'use strict';

/**
 * Bootstrap a global-admin Grant for a user so there is always someone who can
 * manage the system after per-domain authorization is enabled.
 *
 * Usage:
 *   node migrations/grant_bootstrap.js [username]
 *
 * Defaults to the first entry in conf.auth.adminUsers (or 'proxyadmin2').
 * Note: members of conf.auth.adminUsers / conf.auth.adminGroups are already
 * treated as admins without a Grant; this just makes it explicit/visible in the
 * grant list and survives config changes.
 */

const conf = require('@simpleworkjs/conf');
require('../models'); // register all models
const {Grant} = require('../models/grant');

(async function(){
	try{
		let username = process.argv[2]
			|| (conf.auth && conf.auth.adminUsers && conf.auth.adminUsers[0])
			|| 'proxyadmin2';

		let grant = await Grant.create({
			subjectType: 'user',
			subject: username,
			scope: 'global',
			role: 'admin',
			created_by: username,
		});

		console.log(`Granted global admin to "${username}":`, grant.id);
	}catch(error){
		console.error('grant_bootstrap error', error);
	}finally{
		process.exit(0);
	}
})();
