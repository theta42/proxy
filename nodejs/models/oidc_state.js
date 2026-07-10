'use strict';

const Table = require('.');

/**
 * OidcState
 *
 * Short-lived store for an in-flight OpenID Connect authorization request.
 * Keyed by the random `state` value; holds the PKCE `code_verifier` and the
 * post-login redirect target until the SSO calls us back.
 *
 * The record auto-expires via model-redis per-key TTL (static _ttl), so an
 * abandoned login attempt leaves nothing behind and there is no cleanup job.
 */
class OidcState extends Table{
	static _key = 'state';

	// Auth round-trips are quick; 5 minutes is plenty and bounds replay.
	static _ttl = 300;

	static _keyMap = {
		'created_on': {default: function(){return (new Date).getTime()}},
		'state': {isRequired: true, type: 'string', min: 8, max: 500},
		'codeVerifier': {isRequired: true, type: 'string', min: 8, max: 500},
		'redirect': {default: '/', isRequired: false, type: 'string'},
	}
}

OidcState.register();

module.exports = {OidcState};
