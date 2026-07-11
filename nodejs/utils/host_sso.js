'use strict';

/**
 * Pure authorization check for per-host SSO (#57).
 *
 * After the OIDC dance, the callback decides whether the authenticated identity
 * may access the host, based on the host's allow-lists. Enforcing here (at
 * session creation) keeps the OpenResty side simple — the Lua gate only has to
 * confirm a valid session exists for the host.
 *
 * Semantics: empty allow-lists mean "any authenticated user". Otherwise the
 * identity is allowed if its username OR email is in sso_allow_users, or any of
 * its groups is in sso_allow_groups. All comparisons are case-insensitive.
 */
function identityAllowed(identity, allowUsers, allowGroups){
	identity = identity || {};
	allowUsers = Array.isArray(allowUsers) ? allowUsers : [];
	allowGroups = Array.isArray(allowGroups) ? allowGroups : [];

	if(allowUsers.length === 0 && allowGroups.length === 0) return true;

	let lc = s => String(s).trim().toLowerCase();

	let ids = [identity.username, identity.email].filter(Boolean).map(lc);
	let users = allowUsers.map(lc);
	if(ids.some(id => users.includes(id))) return true;

	let groups = (Array.isArray(identity.groups) ? identity.groups : []).map(lc);
	let allow = allowGroups.map(lc);
	if(groups.some(g => allow.includes(g))) return true;

	return false;
}

module.exports = {identityAllowed};
