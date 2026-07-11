'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {
	parseHeaderLines, stringifyHeaders, sanitizeHeaderObject,
	isValidCidr, parseCidrLines, sanitizeCidrArray, stringifyCidrs,
	normalizeHostFeatures, MAX_HEADERS, MAX_CIDRS,
} = require('../../utils/host_features');

/**
 * Pure normalize/validate helpers for the per-host reverse-proxy controls.
 * These are the authoritative server-side validation applied in routes/host.js
 * and are mirrored by the browser form code.
 */
describe('parseHeaderLines', () => {
	test('parses "Name: value" lines into an object', () => {
		assert.deepStrictEqual(
			parseHeaderLines('X-Frame-Options: DENY\nX-A: b'),
			{'X-Frame-Options': 'DENY', 'X-A': 'b'}
		);
	});

	test('splits on the first colon only', () => {
		assert.deepStrictEqual(
			parseHeaderLines('X-Url: https://a.b/c'),
			{'X-Url': 'https://a.b/c'}
		);
	});

	test('skips blank lines and lines without a colon', () => {
		assert.deepStrictEqual(
			parseHeaderLines('\nX-A: 1\n\ngarbage\n'),
			{'X-A': '1'}
		);
	});

	test('rejects invalid header names', () => {
		assert.deepStrictEqual(parseHeaderLines('Bad Name: v\nx y: z'), {});
	});

	test('strips CR/LF from values (no response splitting)', () => {
		let out = parseHeaderLines('X-A: a\rb');   // \r inside a single line
		assert.strictEqual(out['X-A'], 'ab');
	});

	test('handles empty/undefined input', () => {
		assert.deepStrictEqual(parseHeaderLines(''), {});
		assert.deepStrictEqual(parseHeaderLines(undefined), {});
		assert.deepStrictEqual(parseHeaderLines(null), {});
	});

	test('caps the number of headers', () => {
		let lines = [];
		for(let i = 0; i < MAX_HEADERS + 10; i++) lines.push(`X-H${i}: ${i}`);
		assert.strictEqual(Object.keys(parseHeaderLines(lines.join('\n'))).length, MAX_HEADERS);
	});

	test('round-trips through stringifyHeaders', () => {
		let obj = {'X-A': '1', 'X-B': 'two'};
		assert.deepStrictEqual(parseHeaderLines(stringifyHeaders(obj)), obj);
	});
});

describe('sanitizeHeaderObject', () => {
	test('drops bad names and strips CR/LF', () => {
		assert.deepStrictEqual(
			sanitizeHeaderObject({'X-Ok': 'v\r\nInjected: y', 'bad name': 'z'}),
			{'X-Ok': 'vInjected: y'}
		);
	});

	test('handles non-objects', () => {
		assert.deepStrictEqual(sanitizeHeaderObject(null), {});
		assert.deepStrictEqual(sanitizeHeaderObject('x'), {});
	});
});

describe('isValidCidr', () => {
	test('accepts IPv4 with and without a mask', () => {
		assert.ok(isValidCidr('192.168.1.1'));
		assert.ok(isValidCidr('10.0.0.0/8'));
		assert.ok(isValidCidr('0.0.0.0/0'));
	});

	test('rejects out-of-range octets and masks', () => {
		assert.ok(!isValidCidr('256.1.1.1'));
		assert.ok(!isValidCidr('10.0.0.0/33'));
	});

	test('accepts loose IPv6, rejects junk', () => {
		assert.ok(isValidCidr('::1'));
		assert.ok(isValidCidr('fe80::/10'));
		assert.ok(!isValidCidr('not-an-ip'));
		assert.ok(!isValidCidr(''));
		assert.ok(!isValidCidr(42));
	});
});

describe('parseCidrLines / sanitizeCidrArray', () => {
	test('splits on whitespace and commas, keeping valid entries', () => {
		assert.deepStrictEqual(
			parseCidrLines('10.0.0.0/8, 192.168.1.5\nbad\n  '),
			['10.0.0.0/8', '192.168.1.5']
		);
	});

	test('dedupes', () => {
		assert.deepStrictEqual(
			sanitizeCidrArray(['1.1.1.1', '1.1.1.1', '2.2.2.2']),
			['1.1.1.1', '2.2.2.2']
		);
	});

	test('caps the list length', () => {
		let arr = [];
		for(let i = 0; i < MAX_CIDRS + 10; i++) arr.push(`10.0.0.${i % 256}`);
		// includes dupes past .255, so just assert the cap holds
		assert.ok(sanitizeCidrArray(arr).length <= MAX_CIDRS);
	});

	test('round-trips through stringifyCidrs', () => {
		let arr = ['10.0.0.0/8', '192.168.1.5'];
		assert.deepStrictEqual(parseCidrLines(stringifyCidrs(arr)), arr);
	});

	test('handles empty input', () => {
		assert.deepStrictEqual(parseCidrLines(''), []);
		assert.deepStrictEqual(sanitizeCidrArray(null), []);
	});
});

describe('normalizeHostFeatures', () => {
	test('coerces booleans and clamps numbers', () => {
		let body = normalizeHostFeatures({
			ratelimit_enabled: 'true',
			respcache_enabled: 'false',
			hsts_enabled: true,
			ratelimit_rate: '0',      // below min -> 1
			ratelimit_burst: '5000000', // above max -> cap
		});
		assert.strictEqual(body.ratelimit_enabled, true);
		assert.strictEqual(body.respcache_enabled, false);
		assert.strictEqual(body.hsts_enabled, true);
		assert.strictEqual(body.ratelimit_rate, 1);
		assert.strictEqual(body.ratelimit_burst, 1000000);
	});

	test('accepts both text and object/array shapes', () => {
		let fromText = normalizeHostFeatures({
			resp_headers: 'X-A: 1',
			ip_deny: '10.0.0.0/8\nbad',
		});
		assert.deepStrictEqual(fromText.resp_headers, {'X-A': '1'});
		assert.deepStrictEqual(fromText.ip_deny, ['10.0.0.0/8']);

		let fromObj = normalizeHostFeatures({
			resp_headers: {'X-A': '1', 'bad name': 'x'},
			ip_deny: ['10.0.0.0/8', 'junk'],
		});
		assert.deepStrictEqual(fromObj.resp_headers, {'X-A': '1'});
		assert.deepStrictEqual(fromObj.ip_deny, ['10.0.0.0/8']);
	});

	test('only touches present keys (partial update safe)', () => {
		let body = normalizeHostFeatures({host: 'a.b.com', ip: '1.2.3.4'});
		assert.deepStrictEqual(body, {host: 'a.b.com', ip: '1.2.3.4'});
		assert.ok(!('ip_allow' in body));
		assert.ok(!('ratelimit_rate' in body));
	});

	test('junk numbers fall back to defaults', () => {
		let body = normalizeHostFeatures({ratelimit_rate: 'abc', ratelimit_burst: 'x'});
		assert.strictEqual(body.ratelimit_rate, 10);
		assert.strictEqual(body.ratelimit_burst, 20);
	});
});
