'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {hashPassword, hashBasicAuthUsers} = require('../../utils/basicauth');
const {
	parseBasicAuthLines,
	sanitizeBasicAuthObject,
	sanitizeRealm,
	normalizeHostFeatures,
} = require('../../utils/host_features');

/**
 * Per-host basic auth (#57). The hash must match what OpenResty computes in
 * ops/nginx_conf/hostfeatures.lua: base64(sha1(password)) (htpasswd "{SHA}").
 */
describe('basicauth hashing', () => {
	test('base64(sha1(password)) matches the known htpasswd {SHA} vector', () => {
		assert.strictEqual(hashPassword('secret'), '5en6G6MezRroT3XKqkdPOmY/BfQ=');
	});
	test('hashBasicAuthUsers hashes each password, skips empties', () => {
		assert.deepStrictEqual(
			hashBasicAuthUsers({alice: 'secret', bob: '', carol: null}),
			{alice: '5en6G6MezRroT3XKqkdPOmY/BfQ='}
		);
	});
});

describe('parseBasicAuthLines', () => {
	test('parses user:password lines; passwords may contain colons', () => {
		assert.deepStrictEqual(
			parseBasicAuthLines('alice:secret\nbob:pw:with:colons'),
			{alice: 'secret', bob: 'pw:with:colons'}
		);
	});
	test('drops blank lines, lines without a colon, and empty passwords', () => {
		assert.deepStrictEqual(
			parseBasicAuthLines('\nalice:secret\nnopassword\nbob:\n   \n'),
			{alice: 'secret'}
		);
	});
	test('rejects usernames with spaces/control chars', () => {
		assert.deepStrictEqual(parseBasicAuthLines('a b:secret'), {});
	});
});

describe('sanitizeRealm', () => {
	test('strips CR/LF and quotes and trims', () => {
		assert.strictEqual(sanitizeRealm('My "Realm"\r\n'), 'My Realm');
		assert.strictEqual(sanitizeRealm(undefined), '');
	});
});

describe('normalizeHostFeatures (basic auth)', () => {
	test('coerces enabled, parses users to plaintext object, sanitizes realm', () => {
		let body = {
			basicauth_enabled: 'true',
			basicauth_realm: 'Admins\n',
			basicauth_users: 'alice:secret\nbob:pw',
		};
		normalizeHostFeatures(body);
		assert.strictEqual(body.basicauth_enabled, true);
		assert.strictEqual(body.basicauth_realm, 'Admins');
		assert.deepStrictEqual(body.basicauth_users, {alice: 'secret', bob: 'pw'});
	});
	test('empty users input is dropped so a blank edit keeps existing users', () => {
		let body = {basicauth_enabled: 'true', basicauth_users: '   \n'};
		normalizeHostFeatures(body);
		assert.ok(!('basicauth_users' in body));
	});
	test('object input is sanitized like text input', () => {
		let body = {basicauth_users: {alice: 'secret', 'bad user': 'x', bob: ''}};
		normalizeHostFeatures(body);
		assert.deepStrictEqual(body.basicauth_users, {alice: 'secret'});
	});
});
