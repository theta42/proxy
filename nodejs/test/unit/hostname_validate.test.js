'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {
	isValidIPv4,
	isValidHostname,
	isValidHostPattern,
	isValidHostField,
	isValidTargetField,
	collectHostFieldErrors,
} = require('../../utils/hostname_validate');

describe('isValidIPv4', () => {
	test('accepts dotted quads in range', () => {
		assert.ok(isValidIPv4('10.10.10.10'));
		assert.ok(isValidIPv4('0.0.0.0'));
		assert.ok(isValidIPv4('255.255.255.255'));
	});
	test('rejects out-of-range, wrong length, leading zeros, junk', () => {
		assert.ok(!isValidIPv4('256.1.1.1'));
		assert.ok(!isValidIPv4('1.2.3'));
		assert.ok(!isValidIPv4('1.2.3.4.5'));
		assert.ok(!isValidIPv4('01.2.3.4'));
		assert.ok(!isValidIPv4('a.b.c.d'));
	});
});

describe('isValidHostname (strict, for target)', () => {
	test('accepts dotted hostnames with an alphabetic TLD', () => {
		assert.ok(isValidHostname('example.com'));
		assert.ok(isValidHostname('app.internal.net'));
	});
	test('rejects bare labels, numeric TLDs, wildcards', () => {
		assert.ok(!isValidHostname('localhost'));
		assert.ok(!isValidHostname('10.10.10.10'));
		assert.ok(!isValidHostname('*.example.com'));
		assert.ok(!isValidHostname(''));
	});
});

describe('isValidHostPattern (incoming host)', () => {
	test('accepts plain hostnames and single/double wildcards', () => {
		assert.ok(isValidHostPattern('proxy.cloud-ops.net'));
		assert.ok(isValidHostPattern('*.example.com'));
		assert.ok(isValidHostPattern('**.mysite.com'));
		assert.ok(isValidHostPattern('payments.**'));
		assert.ok(isValidHostPattern('**'));           // global catch-all
		assert.ok(isValidHostPattern('*'));
		assert.ok(isValidHostPattern('a.*.b.**.c'));
	});
	test('rejects empty labels, edge hyphens, "***"', () => {
		assert.ok(!isValidHostPattern('a..b'));
		assert.ok(!isValidHostPattern('.example.com'));
		assert.ok(!isValidHostPattern('example.com.'));
		assert.ok(!isValidHostPattern('-bad.example.com'));
		assert.ok(!isValidHostPattern('***.example.com'));
		assert.ok(!isValidHostPattern(''));
	});
});

describe('isValidHostField (host: pattern or IP, no forbidden chars)', () => {
	test('accepts wildcard patterns and IPv4', () => {
		assert.ok(isValidHostField('**'));
		assert.ok(isValidHostField('**.mysite.com'));
		assert.ok(isValidHostField('payments.**'));
		assert.ok(isValidHostField('10.10.10.10'));
	});
	test('rejects protocol, path, port, whitespace', () => {
		assert.ok(!isValidHostField('http://x.com'));
		assert.ok(!isValidHostField('x.com:8080'));
		assert.ok(!isValidHostField('x.com/y'));
		assert.ok(!isValidHostField('a b.com'));
		assert.ok(!isValidHostField(''));
	});
});

describe('isValidTargetField (target: hostname or IP, no wildcard)', () => {
	test('accepts hostnames and IPv4', () => {
		assert.ok(isValidTargetField('app.internal.net'));
		assert.ok(isValidTargetField('10.0.0.5'));
	});
	test('rejects wildcards, protocol, port, path', () => {
		assert.ok(!isValidTargetField('*.example.com'));
		assert.ok(!isValidTargetField('**'));
		assert.ok(!isValidTargetField('http://10.0.0.5'));
		assert.ok(!isValidTargetField('10.0.0.5:443'));
	});
});

describe('collectHostFieldErrors', () => {
	test('no errors when both fields are valid', () => {
		assert.deepStrictEqual(
			collectHostFieldErrors({host: 'api.example.com', ip: '10.0.0.5'}),
			[]
		);
	});
	test('wildcard host with concrete target is allowed', () => {
		assert.deepStrictEqual(
			collectHostFieldErrors({host: '**.example.com', ip: 'app.internal.net'}),
			[]
		);
		assert.deepStrictEqual(collectHostFieldErrors({host: '**'}), []);
		assert.deepStrictEqual(collectHostFieldErrors({host: 'payments.**'}), []);
	});
	test('flags an invalid host with a port', () => {
		let errs = collectHostFieldErrors({host: 'api.example.com:8080', ip: '10.0.0.5'});
		assert.strictEqual(errs.length, 1);
		assert.strictEqual(errs[0].key, 'host');
	});
	test('flags a wildcard target (not allowed) and a protocol target', () => {
		assert.strictEqual(collectHostFieldErrors({ip: '*.example.com'})[0].key, 'ip');
		assert.strictEqual(collectHostFieldErrors({ip: 'http://10.0.0.5'})[0].key, 'ip');
	});
	test('skips absent / empty fields (model handles presence)', () => {
		assert.deepStrictEqual(collectHostFieldErrors({}), []);
		assert.deepStrictEqual(collectHostFieldErrors({host: '', ip: undefined}), []);
	});
});
