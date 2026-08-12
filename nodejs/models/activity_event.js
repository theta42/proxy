'use strict';

const Table = require('.');

const UUID = function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};

/**
 * One row per model event that went out over the socket.
 *
 * The insight this is built on: a notification's hard problem is "who should
 * see this", and utils/socket_pubsub already answers it per socket, per row.
 * So there is no recipient resolution here and no fan-out table — a
 * notification is simply an event that passed your read gate, and history is
 * the same events replayed through the same gate.
 *
 * SHAPE ONLY: model, action, pk, actor, owner, timestamp. No payload.
 * "Something was added over here" is what the feed says, so the body is not
 * needed — and not storing it means history never becomes a second copy of the
 * data, retaining a deleted record's contents after it is gone. `owner` is
 * carried because the owner-scoped gates (ApiToken, Notification, MeshClient,
 * AccessRequest) check a field that is not the pk; everything else the gates
 * need is the pk itself.
 *
 * A later compliance/audit trail extends this rather than replaces it: the
 * missing pieces there are before/after values and immutability, not a
 * different shape.
 *
 * NOT in socket_pubsub's READERS, deliberately — see the note on record().
 */
class ActivityEvent extends Table {
	static _key = 'event_id';

	// Bound growth with a TTL rather than a reaper. 30 days is well past the
	// point anyone scrolls a notification feed, and it keeps the whole set
	// small enough that the feed can sort in memory.
	static _ttl = 60 * 60 * 24 * 30;

	static _keyMap = {
		event_id:   { default: UUID,               type: 'string' },
		// The event, as it appeared on the bus: model:<model>:<action>.
		model:      { isRequired: true,            type: 'string' },
		action:     { isRequired: true,            type: 'string' },
		// Primary key of the record that changed. Most read gates identify a
		// record by exactly this (Host by hostname, User by uid).
		target:     { default: '',                 type: 'string' },
		// Who caused it. Kept, not suppressed: your own actions belong in your
		// history.
		actor:      { default: '',                 type: 'string' },
		// Owner of the record, for the gates that scope by owner rather than pk.
		owner:      { default: '',                 type: 'string' },
		created_on: { default: () => Date.now() },
	};
}

ActivityEvent.register();

// Fields a payload might carry the actor under, most specific first.
const ACTOR_FIELDS = ['updated_by', 'created_by', 'actor', 'uid'];
// ...and the owner.
const OWNER_FIELDS = ['created_by', 'uid', 'username', 'owner', 'requestedBy'];

// Placeholders these apps write when a field has no real value yet — a record
// created but never updated carries updated_by: '__NONE__'. Treating them as
// absent lets the lookup fall through to created_by rather than reporting
// "__NONE__ added a host".
const PLACEHOLDERS = new Set(['__NONE__', 'undefined', 'null']);

function pick(record, fields){
	if (!record || typeof record !== 'object') return '';
	for (const field of fields) {
		const value = record[field];
		if (value === undefined || value === null || value === '') continue;
		if (PLACEHOLDERS.has(String(value))) continue;
		return String(value);
	}
	return '';
}

/**
 * Record an event that has just gone out over the bus.
 *
 * Called from socket_pubsub.attach — where every model event arrives off the
 * bus, once, before it is fanned out to sockets — so nothing needs to remember
 * to log. Only events for gated models are recorded: an event no gate can
 * authorize is one no feed could ever replay.
 *
 * Best-effort by design: a model write must never fail because its history row
 * did not save.
 *
 * NOTE: ActivityEvent must never appear in socket_pubsub's READERS, and must
 * never be wrapped in ModelPs. Recording is gated on READERS, so an entry there
 * would make this function record its own writes forever. There is a test
 * pinning that.
 */
async function record(event){
	try {
		if (!event || !event.model || !event.action) return null;
		return await ActivityEvent.create({
			model:  String(event.model),
			action: String(event.action),
			target: event.pk === undefined || event.pk === null ? '' : String(event.pk),
			actor:  pick(event.data, ACTOR_FIELDS),
			owner:  pick(event.data, OWNER_FIELDS),
		});
	} catch (error) {
		console.error('[activity_event] could not record', event && event.model, error.message);
		return null;
	}
}

/**
 * Recent events, newest first. The TTL keeps this set small enough to sort in
 * memory; callers filter it through the read gates before returning it.
 */
async function recent(limit){
	const rows = await ActivityEvent.listDetail();
	rows.sort((a, b) => Number(b.created_on) - Number(a.created_on));
	return limit ? rows.slice(0, limit) : rows;
}

module.exports = {ActivityEvent, record, recent};
