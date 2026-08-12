'use strict';

const test = require('node:test');
const assert = require('node:assert');

// socket_pubsub deliberately has no load-time model dependency, so the gate
// can be tested as the pure decision it is: given effective rights and a
// record, may this socket see the event?
const {parseTopic, READERS} = require('../../utils/socket_pubsub');

// Effective-rights fixtures, in the shape Permission.effectiveFor returns.
const admin = {isAdmin: true, global: null, domains: {}, groups: []};
const viewerOnExample = {isAdmin: false, global: null, domains: {'example.com': 'viewer'}, groups: []};
const nobody = {isAdmin: false, global: null, domains: {}, groups: []};

test('parseTopic splits model events and rejoins a pk containing colons', () => {
	assert.deepStrictEqual(parseTopic('model:Host:update:a.example.com'), {
		model: 'Host', action: 'update', pk: 'a.example.com',
	});
	assert.deepStrictEqual(parseTopic('model:Entry:update:cn=x,dc=a:dc=b').pk, 'cn=x,dc=a:dc=b');
	assert.strictEqual(parseTopic('not:a:model:topic'), null);
	assert.strictEqual(parseTopic(''), null);
	assert.strictEqual(parseTopic(undefined), null);
});

test('Host events reach only sockets with viewer rights on that domain', () => {
	const record = {host: 'a.example.com'};
	assert.strictEqual(READERS.Host(admin, record), true, 'admin sees everything');
	assert.strictEqual(READERS.Host(viewerOnExample, record), true, 'viewer on the domain sees it');
	assert.strictEqual(READERS.Host(nobody, record), false, 'a user with no grants sees nothing');
});

test('a Host event for an unrelated domain is withheld from a scoped viewer', () => {
	// The bug this gate exists for: viewer on example.com used to receive
	// live updates for every other domain in the install.
	assert.strictEqual(READERS.Host(viewerOnExample, {host: 'secret.other.com'}), false);
});

test('Host falls back to the pk when the payload carries no body', () => {
	assert.strictEqual(READERS.Host(viewerOnExample, null, 'a.example.com'), true);
	assert.strictEqual(READERS.Host(viewerOnExample, null, 'a.other.com'), false);
});

test('a Host event with neither record nor pk is withheld', () => {
	// Fail closed: an unidentifiable record cannot be authorized.
	assert.strictEqual(READERS.Host(viewerOnExample, null, undefined), false);
	assert.strictEqual(READERS.Host(admin, null, undefined), false);
});

test('host matching is case-insensitive', () => {
	assert.strictEqual(READERS.Host(viewerOnExample, {host: 'A.EXAMPLE.COM'}), true);
});

test('DnsProvider events are admin-only', () => {
	assert.strictEqual(READERS.DnsProvider(admin), true);
	assert.strictEqual(READERS.DnsProvider(viewerOnExample), false);
	assert.strictEqual(READERS.DnsProvider(nobody), false);
});

test('DynamicRecord is gated on its fqdn/domain', () => {
	assert.strictEqual(READERS.DynamicRecord(viewerOnExample, {fqdn: 'dyn.example.com'}), true);
	assert.strictEqual(READERS.DynamicRecord(viewerOnExample, {fqdn: 'dyn.other.com'}), false);
	assert.strictEqual(READERS.DynamicRecord(viewerOnExample, {domain: 'example.com'}), true);
});

test('Permission and LocalGroup match their open REST read routes', () => {
	// routes/permission.js:13 and routes/group.js:10 have no authz guard, so
	// gating their events harder than the API would be inconsistent, not safer.
	assert.strictEqual(READERS.Permission(nobody), true);
	assert.strictEqual(READERS.LocalGroup(nobody), true);
});

test('models without a gate are absent from READERS, so they are not broadcast', () => {
	// attach() fails closed on an unlisted model. Cert carries private key
	// material and must never be added without a deliberate gate.
	assert.strictEqual(READERS.Cert, undefined);
	assert.strictEqual(READERS.User, undefined);
	assert.strictEqual(READERS.ApiToken, undefined);
});
