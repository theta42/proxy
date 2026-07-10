'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');

const {safeInternalPath} = require('../../utils/safe_redirect');

/**
 * safeInternalPath guards the OIDC post-login redirect against open-redirect
 * and script-scheme (XSS) targets. Only same-origin "/path" values pass.
 */
describe('safeInternalPath', () => {

	test('allows plain same-origin paths', () => {
		assert.strictEqual(safeInternalPath('/'), '/');
		assert.strictEqual(safeInternalPath('/hosts'), '/hosts');
		assert.strictEqual(safeInternalPath('/dns?x=1'), '/dns?x=1');
		assert.strictEqual(safeInternalPath('/a/b/c#frag'), '/a/b/c#frag');
	});

	test('rejects absolute URLs', () => {
		assert.strictEqual(safeInternalPath('https://evil.com'), '/');
		assert.strictEqual(safeInternalPath('http://evil.com/x'), '/');
	});

	test('rejects protocol-relative and backslash host tricks', () => {
		assert.strictEqual(safeInternalPath('//evil.com'), '/');
		assert.strictEqual(safeInternalPath('/\\evil.com'), '/');
	});

	test('rejects script / data schemes', () => {
		assert.strictEqual(safeInternalPath('javascript:alert(1)'), '/');
		assert.strictEqual(safeInternalPath('data:text/html,<script>'), '/');
	});

	test('rejects non-path and non-string input', () => {
		assert.strictEqual(safeInternalPath('hosts'), '/');       // no leading slash
		assert.strictEqual(safeInternalPath(''), '/');
		assert.strictEqual(safeInternalPath(undefined), '/');
		assert.strictEqual(safeInternalPath(null), '/');
		assert.strictEqual(safeInternalPath({}), '/');
	});
});
