'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const oidc = require('../../utils/oidc');
const conf = require('@simpleworkjs/conf');

/**
 * Tests for the pure parts of the OIDC client (utils/oidc): PKCE/state
 * generation, authorize-URL construction, and claim mapping. Network calls
 * (exchangeCode/fetchUserInfo) are not exercised here.
 */

describe('oidc PKCE / state', () => {
	test('createAuthRequest returns distinct high-entropy state and verifier', () => {
		const a = oidc.createAuthRequest();
		assert.ok(a.state.length >= 20);
		assert.ok(a.codeVerifier.length >= 20);
		assert.notStrictEqual(a.state, a.codeVerifier);

		const b = oidc.createAuthRequest();
		assert.notStrictEqual(a.state, b.state);
	});

	test('code challenge is the base64url S256 of the verifier', () => {
		const {codeVerifier, codeChallenge} = oidc.createAuthRequest();
		const expected = crypto.createHash('sha256').update(codeVerifier).digest('base64')
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		assert.strictEqual(codeChallenge, expected);
	});

	test('challenge is base64url (no +, /, or = padding)', () => {
		const {codeChallenge} = oidc.createAuthRequest();
		assert.ok(!/[+/=]/.test(codeChallenge));
	});
});

describe('oidc buildAuthUrl', () => {
	test('includes required authorization-code + PKCE params', () => {
		const url = new URL(oidc.buildAuthUrl('the-state', 'the-challenge'));
		assert.strictEqual(url.origin + url.pathname, conf.oidc.authorizationEndpoint);
		const p = url.searchParams;
		assert.strictEqual(p.get('response_type'), 'code');
		assert.strictEqual(p.get('client_id'), conf.oidc.clientId);
		assert.strictEqual(p.get('redirect_uri'), conf.oidc.redirectUri);
		assert.strictEqual(p.get('state'), 'the-state');
		assert.strictEqual(p.get('code_challenge'), 'the-challenge');
		assert.strictEqual(p.get('code_challenge_method'), 'S256');
		assert.ok(p.get('scope').includes('openid'));
		assert.ok(p.get('scope').includes('groups'));
	});
});

describe('oidc claimsToIdentity', () => {
	test('maps preferred_username and groups', () => {
		const id = oidc.claimsToIdentity({
			sub: 'abc',
			preferred_username: 'jane',
			groups: ['dns-team', 'proxy-admins'],
		});
		assert.strictEqual(id.username, 'jane');
		assert.deepStrictEqual(id.groups, ['dns-team', 'proxy-admins']);
	});

	test('falls back to sub when no preferred_username', () => {
		const id = oidc.claimsToIdentity({sub: 'abc'});
		assert.strictEqual(id.username, 'abc');
		assert.deepStrictEqual(id.groups, []);
	});

	test('coerces a single group value to an array', () => {
		const id = oidc.claimsToIdentity({sub: 'abc', groups: 'solo'});
		assert.deepStrictEqual(id.groups, ['solo']);
	});
});
