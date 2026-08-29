'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

// Import the PURE helpers, not routes/host_auth.js (which pulls in the model
// layer and wants Redis). The route delegates to these, so testing them here
// covers the same logic without a database.
const {safeRd, callbackUri} = require('../../utils/host_auth_redirect');

// Minimal req stub for safeRd/callbackUri (they only read req.get('host')).
function reqStub(host){
	return {get: (name) => name === 'host' ? host : undefined};
}

describe('safeRd (per-host SSO post-login redirect)', () => {
	const req = reqStub('app.example.com');

	test('allows a plain same-origin path', () => {
		assert.strictEqual(safeRd(req, '/hosts'), '/hosts');
		assert.strictEqual(safeRd(req, '/dns?x=1'), '/dns?x=1');
	});

	test('falls back to "/" for empty/missing input', () => {
		assert.strictEqual(safeRd(req, ''), '/');
		assert.strictEqual(safeRd(req, undefined), '/');
		assert.strictEqual(safeRd(req, null), '/');
	});

	test('rejects protocol-relative and backslash host takeover tricks', () => {
		// "//evil.com" and "/\evil.com" must not pass: both are host takeover
		// vectors that would navigate the browser off-site after login.
		assert.strictEqual(safeRd(req, '//evil.com'), '/');
		assert.strictEqual(safeRd(req, '/\\evil.com'), '/');
	});

	test('allows a full URL that matches this host, returning only its path', () => {
		assert.strictEqual(safeRd(req, 'https://app.example.com/host'), '/host');
		assert.strictEqual(safeRd(req, 'https://app.example.com/a?b=1'), '/a?b=1');
	});

	test('rejects a full URL for a different host', () => {
		assert.strictEqual(safeRd(req, 'https://evil.com/hosts'), '/');
	});
});

describe('callbackUri (per-host SSO OIDC callback)', () => {
	test('is always https regardless of request protocol', () => {
		// Behind a TLS-terminating proxy req.protocol/$http_x_forwarded_proto can
		// be http, but the registered redirect wildcards are https-only. The
		// callback must be https or the OIDC exchange fails on every host.
		const httpReq = reqStub('app.example.com');
		assert.strictEqual(callbackUri(httpReq), 'https://app.example.com/__proxy_auth/callback');
	});
});
