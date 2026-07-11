'use strict';

/**
 * Bootstrap a global-admin Permission for a user so there is always someone who
 * can manage the system after per-domain authorization is enabled.
 *
 * Usage:
 *   node migrations/permission_bootstrap.js [username]
 *
 * Defaults to the first entry in conf.auth.adminUsers (or 'proxyadmin2').
 * Note: members of conf.auth.adminUsers / conf.auth.adminGroups are already
 * treated as admins without a Permission; this just makes it explicit/visible in
 * the permission list and survives config changes.
 */

const conf = require('@simpleworkjs/conf');
require('../models'); // register all models
const {Permission} = require('../models/permission');

(async function(){
	try{
		let username = process.argv[2]
			|| (conf.auth && conf.auth.adminUsers && conf.auth.adminUsers[0])
			|| 'proxyadmin2';

		let permission = await Permission.create({
			subjectType: 'user',
			subject: username,
			scope: 'global',
			role: 'admin',
			created_by: username,
		});

		console.log(`Granted global admin to "${username}":`, permission.id);
	}catch(error){
		console.error('permission_bootstrap error', error);
	}finally{
		process.exit(0);
	}
})();
