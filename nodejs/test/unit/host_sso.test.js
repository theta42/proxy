'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {identityAllowed} = require('../../utils/host_sso');

describe('identityAllowed (per-host SSO authorization)', () => {
	const id = {username: 'alice', email: 'alice@x.com', groups: ['dns-team', 'staff']};

	test('empty allow-lists allow any authenticated user', () => {
		assert.strictEqual(identityAllowed(id, [], []), true);
		assert.strictEqual(identityAllowed(id, undefined, undefined), true);
	});

	test('allows by username', () => {
		assert.strictEqual(identityAllowed(id, ['bob', 'alice'], []), true);
	});

	test('allows by email', () => {
		assert.strictEqual(identityAllowed(id, ['alice@x.com'], []), true);
	});

	test('allows by group membership', () => {
		assert.strictEqual(identityAllowed(id, [], ['dns-team']), true);
	});

	test('denies when neither user nor group matches a non-empty list', () => {
		assert.strictEqual(identityAllowed(id, ['bob'], ['admins']), false);
	});

	test('is case-insensitive', () => {
		assert.strictEqual(identityAllowed(id, ['ALICE'], []), true);
		assert.strictEqual(identityAllowed(id, [], ['DNS-Team']), true);
		assert.strictEqual(identityAllowed({username: 'A', email: 'A@X.com'}, ['a@x.com'], []), true);
	});

	test('handles a missing/empty identity gracefully', () => {
		assert.strictEqual(identityAllowed({}, ['bob'], ['admins']), false);
		assert.strictEqual(identityAllowed({}, [], []), true);
	});
});
