'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {isIPv4, extractIp} = require('../../utils/public_ip');
const {planARecordUpdate} = require('../../utils/dns_records');

/**
 * Pure helpers behind the dynamic-DNS feature: public-IP parsing and the
 * A-record reconciliation decision. The provider I/O and redis-backed model are
 * exercised manually (see the plan's verification section).
 */
describe('isIPv4', () => {
	test('accepts valid dotted quads', () => {
		assert.ok(isIPv4('1.2.3.4'));
		assert.ok(isIPv4('255.255.255.255'));
		assert.ok(isIPv4('0.0.0.0'));
		assert.ok(isIPv4('  10.0.0.1  '));   // trimmed
	});
	test('rejects out-of-range, malformed, IPv6, junk', () => {
		assert.ok(!isIPv4('256.1.1.1'));
		assert.ok(!isIPv4('1.2.3'));
		assert.ok(!isIPv4('1.2.3.4.5'));
		assert.ok(!isIPv4('::1'));
		assert.ok(!isIPv4('example.com'));
		assert.ok(!isIPv4(''));
		assert.ok(!isIPv4(1234));
	});
});

describe('extractIp', () => {
	test('bare text response', () => {
		assert.strictEqual(extractIp('203.0.113.7\n'), '203.0.113.7');
	});
	test('JSON object response (ipify ?format=json)', () => {
		assert.strictEqual(extractIp({ip: '203.0.113.7'}), '203.0.113.7');
		assert.strictEqual(extractIp({origin: '203.0.113.7'}), '203.0.113.7');
	});
	test('finds an embedded IPv4 in noisy text', () => {
		assert.strictEqual(extractIp('Your IP is 203.0.113.7 today'), '203.0.113.7');
	});
	test('returns null for no/invalid IP', () => {
		assert.strictEqual(extractIp('no ip here'), null);
		assert.strictEqual(extractIp({ip: 'not-an-ip'}), null);
		assert.strictEqual(extractIp(null), null);
		assert.strictEqual(extractIp('2001:db8::1'), null);
	});
});

describe('planARecordUpdate', () => {
	const IP = '203.0.113.10';

	test('creates when no matching record exists', () => {
		assert.deepStrictEqual(
			planARecordUpdate([], 'home', IP),
			{deleteIds: [], create: true}
		);
	});

	test('no-op when a correct record already exists', () => {
		let recs = [{id: '1', name: 'home', data: IP}];
		assert.deepStrictEqual(
			planARecordUpdate(recs, 'home', IP),
			{deleteIds: [], create: false}
		);
	});

	test('deletes stale same-name records and re-creates on IP change', () => {
		let recs = [{id: '1', name: 'home', data: '198.51.100.1'}];
		assert.deepStrictEqual(
			planARecordUpdate(recs, 'home', IP),
			{deleteIds: ['1'], create: true}
		);
	});

	test('deletes duplicates but keeps the correct one (no re-create)', () => {
		let recs = [
			{id: '1', name: 'home', data: IP},
			{id: '2', name: 'home', data: '198.51.100.9'},
		];
		assert.deepStrictEqual(
			planARecordUpdate(recs, 'home', IP),
			{deleteIds: ['2'], create: false}
		);
	});

	test('ignores records for other names', () => {
		let recs = [{id: '1', name: 'other', data: '198.51.100.1'}];
		assert.deepStrictEqual(
			planARecordUpdate(recs, 'home', IP),
			{deleteIds: [], create: true}
		);
	});

	test('apex matches records whose parsed name is empty', () => {
		let recs = [{id: '1', name: '', data: '198.51.100.1'}];
		assert.deepStrictEqual(
			planARecordUpdate(recs, '', IP),
			{deleteIds: ['1'], create: true}
		);
	});
});
