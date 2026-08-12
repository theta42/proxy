'use strict';

/**
 * Per-socket authorization for model events pushed over Socket.IO.
 *
 * The bridge used to be `app.io.emit('P2PSub', {topic, data})` — every model
 * event, with its full record, to every connected socket. Authentication was
 * the only gate: any logged-in user received every Host, DnsProvider and
 * Permission payload regardless of whether the REST API would have let them
 * read it. A user with viewer rights on one domain saw live updates for every
 * other domain in the install.
 *
 * This module applies the same access decision the REST routes apply, per
 * socket, before the event leaves the server.
 *
 * Adding a model to the live-update path means adding it to READERS below.
 * Unlisted models are not broadcast at all — a new model must opt in
 * deliberately rather than start leaking the moment someone wraps it in
 * ModelPs.
 */

// `roles` is a pure module (no Redis, no model registry). Requiring
// models/permission at load time instead would drag in models/index, whose
// bootstrap creates an admin user as a side effect — something merely loading
// this file should never do. Permission.allows *is* roles.allows; the model is
// only needed for effectiveFor, which is required lazily below.
const roles = require('./roles');

// How long a socket's resolved rights stay cached. Rights are also busted
// eagerly when a grant or group changes (see invalidateAll), so this is a
// backstop for changes that arrive by other means (e.g. SSO group refresh),
// not the primary path.
const EFFECTIVE_TTL_MS = 30 * 1000;

// Read gates, mirroring the `router.get` guards in routes/*.js:
//   Host           routes/host.js:218  requireDomainRole('viewer', host)
//   DynamicRecord  routes/dns.js:71    requireDomainRole('viewer', domain)
//   DnsProvider    routes/dns.js:156   requireAdmin
//   Permission     routes/permission.js:13  any authenticated user
//   LocalGroup     routes/group.js:10       any authenticated user
const READERS = {
	Host(effective, record, pk){
		const host = (record && record.host) || pk;
		if(!host) return false;
		return roles.allows(effective, 'viewer', String(host).toLowerCase().trim());
	},

	DynamicRecord(effective, record, pk){
		const target = (record && (record.fqdn || record.domain)) || pk;
		if(!target) return false;
		return roles.allows(effective, 'viewer', String(target).toLowerCase().trim());
	},

	DnsProvider(effective){
		return !!effective.isAdmin;
	},

	Permission(){
		return true;
	},

	LocalGroup(){
		return true;
	},

	// routes/user.js:19 — GET /api/user is authz.requireAdmin. A user also
	// reads themselves via /api/user/me, so the gate is admin OR self rather
	// than admin only: row-level, not just model-level.
	User(effective, record, pk){
		if(effective.isAdmin) return true;
		const self = effective.username;
		const subject = (record && record.username) || pk;
		return !!self && !!subject && String(subject) === String(self);
	},

	// routes/api_token.js — self-service, owner-scoped, with no admin path.
	// Deliberately no admin bypass here either: a personal access token is
	// nobody else's business, and the REST route agrees.
	ApiToken(effective, record, pk){
		const self = effective.username;
		const owner = record && record.created_by;
		return !!self && !!owner && String(owner) === String(self);
	},
};

// Models whose events invalidate cached rights: a grant or group-membership
// change alters what every other socket may read, so holding a 30s cache
// across one would leave users seeing (or missing) rows for that long.
const RIGHTS_MODELS = new Set(['Permission', 'LocalGroup']);

const warnedModels = new Set();

// `model:Host:update:example.com` -> {model, action, pk}
// A pk may itself contain ':', so the tail is rejoined rather than split off.
function parseTopic(topic){
	const parts = String(topic || '').split(':');
	if(parts[0] !== 'model' || parts.length < 3) return null;
	return {
		model: parts[1],
		action: parts[2],
		pk: parts.length > 3 ? parts.slice(3).join(':') : undefined,
	};
}

// Resolve (and briefly cache) a socket's effective rights. Sockets are
// long-lived, so without a cache every event would re-read every grant from
// Redis once per connected client.
async function effectiveFor(socket){
	const now = Date.now();
	if(socket._effective && socket._effectiveAt > now - EFFECTIVE_TTL_MS){
		return socket._effective;
	}
	// Required here, not at module load: see the roles import above.
	const {Permission} = require('../models/permission');
	socket._effective = await Permission.effectiveFor({
		username: socket.user && socket.user.username,
		groups: socket.groups || [],
	});
	// effectiveFor returns rights, not identity; the row-level gates below need
	// to know WHO this socket is to compare against a record's owner.
	socket._effective.username = socket.user && socket.user.username;
	socket._effectiveAt = now;
	return socket._effective;
}

function invalidateAll(io){
	for(const socket of io.sockets.sockets.values()){
		socket._effective = null;
		socket._effectiveAt = 0;
	}
}

/**
 * Bridge the server-side pubsub bus onto authorized sockets.
 *
 * @param {Object} io - the Socket.IO server
 * @param {Object} ps - the p2psub bus (controller/pubsub)
 */
function attach(io, ps){
	ps.subscribe(/^model:/, function(data, topic){
		const event = parseTopic(topic);
		if(!event) return;

		const canRead = READERS[event.model];

		// Every event that goes out is a notification, so this is also where
		// history is recorded — once per event, before the per-socket fan-out.
		// Only gated models: an event no gate can authorize is one no feed
		// could replay. Not awaited; a model write must not wait on its
		// history row.
		if(canRead){
			// Required here, not at module load: models/activity_event pulls in
			// models/index, whose bootstrap creates an admin user as a side
			// effect. Merely loading this file must not do that — see the note
			// on the roles import above.
			require('../models/activity_event')
				.record({model: event.model, action: event.action, pk: event.pk, data});
		}
		if(!canRead){
			// Fail closed. Warn once per model so a missing entry surfaces in
			// the log instead of looking like a silently broken live update.
			if(!warnedModels.has(event.model)){
				warnedModels.add(event.model);
				console.warn(`[socket_pubsub] no read gate for model '${event.model}'; its events are not broadcast. Add it to READERS in utils/socket_pubsub.js.`);
			}
			return;
		}

		if(RIGHTS_MODELS.has(event.model)) invalidateAll(io);

		for(const socket of io.sockets.sockets.values()){
			// authIO rejects unauthenticated sockets, so a socket without a
			// user should not exist; skip rather than trust it if one does.
			if(!socket.user) continue;

			effectiveFor(socket).then(function(effective){
				let allowed = false;
				try{
					allowed = canRead(effective, data, event.pk);
				}catch(error){
					console.error(`[socket_pubsub] read gate for '${event.model}' threw:`, error);
					allowed = false;
				}
				if(allowed) socket.emit('P2PSub', {topic, data});
			}).catch(function(error){
				console.error('[socket_pubsub] could not resolve rights for socket:', error);
			});
		}
	});

	// Note: there is deliberately no `socket.on('P2PSub')` handler. Clients
	// used to be able to publish any topic into the server-side bus, which was
	// then rebroadcast to every other client — an injection path with no
	// legitimate traffic on it (no app code has ever called app.publish()).
	// Events flow server -> client only.
}

module.exports = {attach, parseTopic, READERS};
