'use strict';

const Table = require('.');
const conf = require('@simpleworkjs/conf');
const roles = require('../utils/roles');

/**
 * Grant
 *
 * Assigns a role to a subject (a user or a group), either globally or for a
 * single domain. Per-user overrides and group defaults both live here; group
 * defaults can also be seeded from conf.auth.groupRoleMap.
 *
 *   subjectType : 'user' | 'group'
 *   subject     : username or group name
 *   scope       : 'global' | 'domain'
 *   domain      : domain name when scope==='domain' (else '*')
 *   role        : 'admin' | 'manager' | 'viewer'
 *
 * See Grant.effectiveFor() for how these, plus ownership (created_by) and
 * conf.auth, collapse into a request's effective rights.
 */
class Grant extends Table{
	static _key = 'id';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'id': {isRequired: true, type: 'string', min: 3, max: 1100},
		'subjectType': {isRequired: true, type: 'string'},
		'subject': {isRequired: true, type: 'string', min: 1, max: 500},
		'scope': {default: 'domain', isRequired: true, type: 'string'},
		'domain': {default: '*', isRequired: false, type: 'string'},
		'role': {isRequired: true, type: 'string'},
	}

	static roles = ['viewer', 'manager', 'admin'];
	// Re-export the pure helpers so existing callers (middleware/authz) can use
	// them off the model.
	static rank = roles.rank;
	static maxRole = roles.maxRole;
	static roleForDomain = roles.roleForDomain;
	static allows = roles.allows;
	static visibleDomains = roles.visibleDomains;

	// Deterministic id so the same (subject, scope, domain) grant is a single
	// record — re-granting updates rather than duplicating.
	static mkId({subjectType, subject, scope, domain}){
		return `${subjectType}:${subject}:${scope || 'domain'}:${scope === 'global' ? '*' : (domain || '*')}`;
	}

	static async create(data){
		if(!this.roles.includes(data.role)){
			throw this.errors.ObjectValidateError([{key: 'role', message: `role must be one of ${this.roles.join(', ')}`}]);
		}
		if(!['user', 'group'].includes(data.subjectType)){
			throw this.errors.ObjectValidateError([{key: 'subjectType', message: `subjectType must be 'user' or 'group'`}]);
		}
		if(data.scope === 'global') data.domain = '*';
		data.id = this.mkId(data);
		// Upsert: replace an existing identical-scoped grant instead of 409ing.
		try{
			let existing = await this.get(data.id);
			if(existing) await existing.remove();
		}catch(error){ /* not found is fine */ }

		return super.create(data);
	}

	/**
	 * Collapse conf.auth, grant records, and resource ownership into the
	 * effective rights for a session identity.
	 *
	 * @param {Object} identity - {username, groups: string[]}
	 * @returns {Object} { isAdmin, global: role|null, domains: {domain: role} }
	 *   - isAdmin: full access to everything.
	 *   - global: a non-admin global role (manager/viewer) applied to every
	 *     domain the user can see.
	 *   - domains: explicit per-domain roles (includes owned domains).
	 */
	static async effectiveFor(identity){
		let username = identity && identity.username;

		// Fetch the redis-backed inputs, then hand off to the pure resolver.
		let grants = [];
		try{
			grants = await this.listDetail();
		}catch(error){ grants = []; }

		// Ownership: a user has manager rights over every domain they (or the
		// DNS provider they created) own. Domain.created_by already carries the
		// provider creator, so a single Domain scan covers both.
		let ownedDomains = [];
		if(username){
			try{
				let Domain = require('.').models.Domain;
				ownedDomains = (await Domain.listDetail())
					.filter(d => d.created_by === username)
					.map(d => d.domain);
			}catch(error){ /* domains unavailable, skip ownership */ }
		}

		return roles.resolveEffective(identity, {
			grants,
			ownedDomains,
			authConf: conf.auth || {},
		});
	}
}

Grant.register();

module.exports = {Grant};
