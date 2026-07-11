'use strict';

/**
 * Pure authorization role logic — no redis, no I/O — so it can be unit tested
 * in isolation. models/grant.js supplies the data (grant records, owned
 * domains, conf.auth) and this module collapses it into effective rights and
 * answers allow/deny questions.
 *
 * Roles rank: admin > manager (owner/full over a domain) > viewer.
 */

const ROLE_RANK = {viewer: 1, manager: 2, admin: 3};

function rank(role){
	return ROLE_RANK[role] || 0;
}

// Whichever of two roles is stronger; either may be null/undefined.
function maxRole(a, b){
	if(rank(a) >= rank(b)) return a || b || null;
	return b || a || null;
}

/**
 * Collapse config, grants, and ownership into effective rights.
 *
 * @param {Object} identity - {username, groups: string[]}
 * @param {Object} data
 *   - grants: [{subjectType, subject, scope, domain, role}]
 *   - ownedDomains: string[] (domains the user owns via created_by)
 *   - authConf: conf.auth ({adminUsers, adminGroups, groupRoleMap})
 * @returns {Object} { isAdmin, global: role|null, domains: {domain: role} }
 */
function resolveEffective(identity, data){
	let username = identity && identity.username;
	let groups = (identity && identity.groups) || [];
	let grants = (data && data.grants) || [];
	let ownedDomains = (data && data.ownedDomains) || [];
	let authConf = (data && data.authConf) || {};

	let result = {isAdmin: false, global: null, domains: {}};

	// 1) Config-driven global admin (anti-lockout bootstrap).
	if((authConf.adminUsers || []).includes(username)) result.isAdmin = true;
	for(let g of groups){
		if((authConf.adminGroups || []).includes(g)) result.isAdmin = true;
	}

	// 2) Config-driven group role defaults.
	let groupRoleMap = authConf.groupRoleMap || {};
	for(let g of groups){
		let m = groupRoleMap[g];
		if(!m) continue;
		if(m.role === 'admin' && (m.scope === 'global' || !m.scope)){
			result.isAdmin = true;
		}else if(m.scope === 'global'){
			result.global = maxRole(result.global, m.role);
		}else if(m.domain){
			result.domains[m.domain] = maxRole(result.domains[m.domain], m.role);
		}
	}

	// 3) Grant records for this user or any of their groups.
	for(let grant of grants){
		let matches = (grant.subjectType === 'user' && grant.subject === username)
			|| (grant.subjectType === 'group' && groups.includes(grant.subject));
		if(!matches) continue;

		if(grant.scope === 'global'){
			if(grant.role === 'admin') result.isAdmin = true;
			else result.global = maxRole(result.global, grant.role);
		}else{
			result.domains[grant.domain] = maxRole(result.domains[grant.domain], grant.role);
		}
	}

	// 4) Ownership: manager rights over every owned domain.
	for(let domain of ownedDomains){
		result.domains[domain] = maxRole(result.domains[domain], 'manager');
	}

	return result;
}

/**
 * Match a permission's domain pattern against a full hostname.
 *
 * A pattern with no wildcard matches the host exactly, or any subdomain of it
 * (so a permission on "example.com" still covers "api.example.com", preserving
 * the pre-wildcard behavior). Wildcards operate on dot-separated labels:
 *   "*"  consumes exactly one label   ("*.example.com"  -> "a.example.com")
 *   "**" consumes zero or more labels ("**.example.com" -> "example.com",
 *                                       "a.b.example.com")
 * The whole host must be consumed. Bare "*" matches any single-label host; bare
 * "**" matches everything.
 */
function domainMatch(pattern, host){
	if(!pattern || !host) return false;
	pattern = String(pattern).toLowerCase().trim();
	host = String(host).toLowerCase().trim();
	if(!host) return false;

	if(!pattern.includes('*')){
		return host === pattern || host.endsWith('.' + pattern);
	}
	return globLabels(pattern.split('.'), host.split('.'));
}

// Two-pointer globstar over label arrays; backtracking handles multiple "**".
function globLabels(p, h){
	let pi = 0, hi = 0;
	let star = -1, starHi = 0;
	while(hi < h.length){
		if(pi < p.length && p[pi] === '**'){
			// Assume "**" matches nothing for now; remember it to backtrack.
			star = pi; starHi = hi; pi++;
		}else if(pi < p.length && (p[pi] === '*' || p[pi] === h[hi])){
			pi++; hi++;
		}else if(star !== -1){
			// Let the most recent "**" swallow one more label.
			pi = star + 1; starHi++; hi = starHi;
		}else{
			return false;
		}
	}
	while(pi < p.length && p[pi] === '**') pi++;
	return pi === p.length;
}

// Effective role on one host, folding in admin, any global role, and every
// domain pattern (incl. wildcards) that matches the host.
function roleForDomain(effective, host){
	if(effective.isAdmin) return 'admin';
	let role = effective.global;
	for(let pattern in effective.domains){
		if(domainMatch(pattern, host)){
			role = maxRole(role, effective.domains[pattern]);
		}
	}
	return role;
}

// Does `effective` meet or exceed `minRole` for `domain`?
function allows(effective, minRole, domain){
	return rank(roleForDomain(effective, domain)) >= rank(minRole);
}

// Domain names the identity can at least view (excludes the global-role case,
// which callers treat as "sees everything").
function visibleDomains(effective){
	return Object.keys(effective.domains).filter(d => rank(effective.domains[d]) >= rank('viewer'));
}

module.exports = {
	ROLE_RANK,
	rank,
	maxRole,
	resolveEffective,
	domainMatch,
	roleForDomain,
	allows,
	visibleDomains,
};
