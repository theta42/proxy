'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {passwordError} = require('../../utils/password_policy');

/**
 * The old rule (issue #48) rejected strong passwords and accepted weak ones.
 * These pin the corrected behavior: length-forward, 3-of-4 character classes.
 */
describe('passwordError', () => {
	test('accepts a strong mixed password (previously rejected)', () => {
		assert.strictEqual(passwordError('@123Caplowercase'), null);
	});
	test('accepts a 12+ char passphrase on length alone', () => {
		assert.strictEqual(passwordError('correcthorsebattery'), null);
	});
	test('rejects a weak two-class password (previously accepted)', () => {
		assert.notStrictEqual(passwordError('lowercase1'), null);
	});
	test('rejects too-short passwords', () => {
		assert.notStrictEqual(passwordError('Ab3$xy'), null);   // 6 chars
		assert.notStrictEqual(passwordError(''), null);
		assert.notStrictEqual(passwordError(undefined), null);
	});
	test('accepts 8 chars with 3 classes', () => {
		assert.strictEqual(passwordError('Abcd123!'), null);   // upper, lower, num, sym
		assert.strictEqual(passwordError('Abcdefg1'), null);   // upper, lower, num
	});
	test('rejects 8-11 chars with only 2 classes', () => {
		assert.notStrictEqual(passwordError('abcdefg1'), null);   // lower + num only
		assert.notStrictEqual(passwordError('ABCDEFG1'), null);   // upper + num only
	});
});
