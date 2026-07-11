'use strict';

/**
 * Data migration for the Grant -> Permission rename.
 *
 * model-redis namespaces keys by the JS class name, so renaming the class moved
 * storage from `<prefix>Grant` / `<prefix>Grant_<id>` to `<prefix>Permission*`.
 * This copies every old Grant record into the Permission model (ids are
 * unchanged — mkId never encoded the word "grant") and then removes the old
 * records. Idempotent: safe to re-run (already-migrated ids just upsert; missing
 * old records are skipped).
 *
 * Usage:
 *   node migrations/rename_grant_to_permission.js
 */

const Table = require('../models');      // base Table (shares the app's client/prefix)
require('../models');                     // register all models (incl. Permission)
const {Permission} = require('../models/permission');

// A throwaway model whose class name is literally "Grant" so it reads the old
// namespace regardless of the configured key prefix.
class Grant extends Table{
	static _key = 'id';
	static _keyMap = Permission._keyMap;
}
Grant.register();

(async function(){
	try{
		let old = [];
		try{
			old = await Grant.listDetail();
		}catch(error){
			console.log('No legacy Grant records found; nothing to migrate.');
			process.exit(0);
		}

		console.log(`Found ${old.length} Grant record(s) to migrate.`);
		let migrated = 0;
		for(let g of old){
			// Permission.create is an upsert on the deterministic id.
			await Permission.create({
				subjectType: g.subjectType,
				subject: g.subject,
				scope: g.scope,
				domain: g.domain,
				role: g.role,
				created_by: g.created_by,
				created_on: g.created_on,
			});
			migrated++;
		}

		// Remove the legacy records now that they live under Permission.
		for(let g of old){
			try{
				let inst = await Grant.get(g.id);
				await inst.remove();
			}catch(error){ /* already gone */ }
		}

		console.log(`Migrated ${migrated} record(s) Grant -> Permission and removed the old entries.`);
		process.exit(0);
	}catch(error){
		console.error('rename_grant_to_permission error', error);
		process.exit(1);
	}
})();
