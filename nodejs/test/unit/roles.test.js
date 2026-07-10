'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const roles = require('../../utils/roles');

/**
 * Tests for the pure authorization logic (utils/roles). No redis: grant rows,
 * owned domains, and conf.auth are passed in directly. This is the heart of the
 * per-domain rights model — see models/grant.js for the redis-backed wiring.
 */

const authConf = {
	adminUsers: ['root'],
	adminGroups: ['proxy-admins'],
	groupRoleMap: {
		'global-viewers': {scope: 'global', role: 'viewer'},
		'foo-managers': {scope: 'domain', domain: 'foo.com', role: 'manager'},
		'super': {scope: 'global', role: 'admin'},
	},
};

const effective = (identity, data) =>
	roles.resolveEffective(identity, {authConf, ...data});

describe('roles.resolveEffective', () => {

	describe('admin', () => {
		test('conf adminUsers grants global admin', () => {
			const e = effective({username: 'root', groups: []});
			assert.strictEqual(e.isAdmin, true);
		});

		test('conf adminGroups grants global admin', () => {
			const e = effective({username: 'bob', groups: ['proxy-admins']});
			assert.strictEqual(e.isAdmin, true);
		});

		test('groupRoleMap admin role grants global admin', () => {
			const e = effective({username: 'bob', groups: ['super']});
			assert.strictEqual(e.isAdmin, true);
		});

		test('a global admin Grant record grants admin', () => {
			const e = effective({username: 'bob', groups: []}, {
				grants: [{subjectType: 'user', subject: 'bob', scope: 'global', role: 'admin'}],
			});
			assert.strictEqual(e.isAdmin, true);
		});

		test('admin passes every domain check', () => {
			const e = effective({username: 'root', groups: []});
			assert.strictEqual(roles.allows(e, 'manager', 'anything.com'), true);
			assert.strictEqual(roles.roleForDomain(e, 'anything.com'), 'admin');
		});

		test('a plain user is not admin', () => {
			const e = effective({username: 'nobody', groups: []});
			assert.strictEqual(e.isAdmin, false);
		});
	});

	describe('per-domain grants', () => {
		test('user manager grant allows manage on that domain only', () => {
			const e = effective({username: 'jane', groups: []}, {
				grants: [{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'ex.com', role: 'manager'}],
			});
			assert.strictEqual(roles.allows(e, 'manager', 'ex.com'), true);
			assert.strictEqual(roles.allows(e, 'viewer', 'ex.com'), true);
			assert.strictEqual(roles.allows(e, 'manager', 'other.com'), false);
			assert.strictEqual(roles.allows(e, 'viewer', 'other.com'), false);
		});

		test('viewer grant allows read but not manage', () => {
			const e = effective({username: 'jane', groups: []}, {
				grants: [{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'ex.com', role: 'viewer'}],
			});
			assert.strictEqual(roles.allows(e, 'viewer', 'ex.com'), true);
			assert.strictEqual(roles.allows(e, 'manager', 'ex.com'), false);
		});

		test('group grant applies to members', () => {
			const e = effective({username: 'jane', groups: ['dns-team']}, {
				grants: [{subjectType: 'group', subject: 'dns-team', scope: 'domain', domain: 'ex.com', role: 'manager'}],
			});
			assert.strictEqual(roles.allows(e, 'manager', 'ex.com'), true);
		});

		test('group grant does not apply to non-members', () => {
			const e = effective({username: 'jane', groups: []}, {
				grants: [{subjectType: 'group', subject: 'dns-team', scope: 'domain', domain: 'ex.com', role: 'manager'}],
			});
			assert.strictEqual(roles.allows(e, 'viewer', 'ex.com'), false);
		});

		test('groupRoleMap domain default applies', () => {
			const e = effective({username: 'jane', groups: ['foo-managers']});
			assert.strictEqual(roles.allows(e, 'manager', 'foo.com'), true);
			assert.strictEqual(roles.allows(e, 'manager', 'bar.com'), false);
		});
	});

	describe('override precedence (strongest wins)', () => {
		test('a per-user manager grant beats a group viewer grant', () => {
			const e = effective({username: 'jane', groups: ['team']}, {
				grants: [
					{subjectType: 'group', subject: 'team', scope: 'domain', domain: 'ex.com', role: 'viewer'},
					{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'ex.com', role: 'manager'},
				],
			});
			assert.strictEqual(roles.roleForDomain(e, 'ex.com'), 'manager');
		});

		test('grant order does not matter (max wins)', () => {
			const e = effective({username: 'jane', groups: []}, {
				grants: [
					{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'ex.com', role: 'manager'},
					{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'ex.com', role: 'viewer'},
				],
			});
			assert.strictEqual(roles.roleForDomain(e, 'ex.com'), 'manager');
		});
	});

	describe('ownership', () => {
		test('owned domains grant manager without an explicit grant', () => {
			const e = effective({username: 'owner', groups: []}, {
				ownedDomains: ['mine.com'],
			});
			assert.strictEqual(roles.roleForDomain(e, 'mine.com'), 'manager');
			assert.strictEqual(roles.allows(e, 'manager', 'mine.com'), true);
			assert.strictEqual(roles.allows(e, 'viewer', 'notmine.com'), false);
		});
	});

	describe('global (non-admin) roles', () => {
		test('global viewer sees every domain read-only', () => {
			const e = effective({username: 'v', groups: ['global-viewers']});
			assert.strictEqual(e.global, 'viewer');
			assert.strictEqual(roles.allows(e, 'viewer', 'a.com'), true);
			assert.strictEqual(roles.allows(e, 'viewer', 'b.com'), true);
			assert.strictEqual(roles.allows(e, 'manager', 'a.com'), false);
		});
	});

	describe('visibleDomains', () => {
		test('lists domains with at least viewer', () => {
			const e = effective({username: 'jane', groups: []}, {
				grants: [
					{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'a.com', role: 'viewer'},
					{subjectType: 'user', subject: 'jane', scope: 'domain', domain: 'b.com', role: 'manager'},
				],
			});
			assert.deepStrictEqual(roles.visibleDomains(e).sort(), ['a.com', 'b.com']);
		});
	});
});

describe('roles.rank / maxRole', () => {
	test('rank ordering', () => {
		assert.ok(roles.rank('admin') > roles.rank('manager'));
		assert.ok(roles.rank('manager') > roles.rank('viewer'));
		assert.ok(roles.rank('viewer') > roles.rank(null));
	});

	test('maxRole returns the stronger role', () => {
		assert.strictEqual(roles.maxRole('viewer', 'manager'), 'manager');
		assert.strictEqual(roles.maxRole('manager', 'viewer'), 'manager');
		assert.strictEqual(roles.maxRole(null, 'viewer'), 'viewer');
		assert.strictEqual(roles.maxRole(null, null), null);
	});
});
