'use strict';

// Pure DNS-record reconciliation logic, kept out of models/dns_provider.js so it
// can be unit-tested without a redis connection. Used by Domain.upsertARecord.

/**
 * Decide how to reconcile an A record to `ip`, given the domain's current A
 * records (as returned by a provider's getRecords: {id, name, data}) and the
 * target sub-name (`''` for apex).
 *
 * Returns {deleteIds: [...], create: bool}: delete every same-name A record whose
 * value differs, and create a new one unless a correct one already exists.
 */
function planARecordUpdate(aRecords, sub, ip){
	let matches = (aRecords || []).filter(r => (r.name || '') === sub);
	let correct = matches.some(r => r.data === ip);
	let deleteIds = matches.filter(r => r.data !== ip).map(r => r.id);
	return {deleteIds, create: !correct};
}

module.exports = {planARecordUpdate};
