'use strict';

const {describe, test, before} = require('node:test');
const assert = require('node:assert');

/**
 * Tests for Host lookup algorithm
 *
 * The Host.lookUp method implements a complex tree-based lookup system
 * that supports exact matches, single wildcards (*), and double wildcards (**).
 *
 * Pattern matching priority (highest to lowest):
 * 1. Exact match (example.com)
 * 2. Single wildcard (*.example.com matches any.example.com)
 * 3. Double wildcard (**.example.com matches any.sub.domain.example.com)
 *
 * These tests validate the lookup algorithm without requiring a Redis connection.
 */

describe('Host Lookup Algorithm', () => {

	let Host;

	before(async () => {
		// Mock the Host class and build a test lookup tree
		Host = createMockHostClass();
		await populateTestData(Host);
	});

	test('should match exact host', () => {
		const result = Host.lookUp('payments.718it.biz');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'payments.718it.biz');
	});

	test('should return undefined for non-existent host', () => {
		const result = Host.lookUp('sd.blah.test.vm42.com');
		assert.strictEqual(result, undefined);
	});

	test('should match double wildcard at any depth', () => {
		const result = Host.lookUp('payments.test.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'payments.**');
	});

	test('should match double wildcard with multiple subdomains', () => {
		const result = Host.lookUp('test.sample.other.exmaple.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, '**.exmaple.com');
	});

	test('should prefer exact match over wildcard', () => {
		const result = Host.lookUp('stan.test.vm42.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'stan.test.vm42.com');
	});

	test('should match at root level', () => {
		const result = Host.lookUp('test.vm42.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'test.vm42.com');
	});

	test('should match single wildcard', () => {
		const result = Host.lookUp('blah.test.vm42.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, '*.test.vm42.com');
	});

	test('should match double wildcard for top-level domain queries', () => {
		const result = Host.lookUp('payments.example.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'payments.**');
	});

	test('should match single wildcard in middle of domain', () => {
		const result = Host.lookUp('info.wma.users.718it.biz');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'info.*.users.718it.biz');
	});

	test('should return undefined when single wildcard does not match', () => {
		const result = Host.lookUp('infof.users.718it.biz');
		assert.strictEqual(result, undefined);
	});

	test('should return undefined for non-existent TLD', () => {
		const result = Host.lookUp('blah.biz');
		assert.strictEqual(result, undefined);
	});

	test('should match multiple single wildcards', () => {
		const result = Host.lookUp('test.1.2.718it.net');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'test.*.*.718it.net');
	});

	test('should match exact subdomain', () => {
		const result = Host.lookUp('test1.exmaple.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'test1.exmaple.com');
	});

	test('should match single wildcard when exact not found', () => {
		const result = Host.lookUp('other.exmaple.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, '*.exmaple.com');
	});

	test('should match double wildcard with subdomain prefix', () => {
		const result = Host.lookUp('info.payments.example.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, 'info.**');
	});

	test('should match bare domain', () => {
		const result = Host.lookUp('718it.biz');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, '718it.biz');
	});

	test('should handle single-part domain', () => {
		const result = Host.lookUp('localhost');
		assert.strictEqual(result, undefined);
	});

	test('should handle empty string', () => {
		const result = Host.lookUp('');
		assert.strictEqual(result, undefined);
	});

	test('should be case-sensitive', () => {
		const result = Host.lookUp('PAYMENTS.718it.biz');
		assert.strictEqual(result, undefined);
	});
});

/**
 * Tests for the wildcard's-own-base-domain fix: a single-level wildcard's
 * issued cert also covers its own base domain (altNames: [domain, *.domain],
 * see utils/letsencrypt.js), but that base domain sits one tree level ABOVE
 * the wildcard's own leaf. buildLookUpObj() now also stamps that parent
 * node's #record, and lookUpWildcardParent() finds it even when the base
 * domain is ALSO separately registered as its own plain host (the "attach an
 * existing host to a parent wildcard" case, unlike lookUp() which would just
 * resolve to that host's own record).
 */
describe('Host wildcard base-domain lookup', () => {

	let Host;

	before(async () => {
		Host = createMockHostClassWithWildcardParentFix();
	});

	test('lookUp finds the wildcard record for its own bare base domain when no plain host exists', async () => {
		await populateTree(Host, ['*.cool.mysite.com']);
		const result = Host.lookUp('cool.mysite.com');
		assert.ok(result, 'Should find a match');
		assert.strictEqual(result.host, '*.cool.mysite.com');
	});

	test('lookUp still prefers an explicitly-created plain host over the wildcard, regardless of population order', async () => {
		await populateTree(Host, ['*.cool.mysite.com', 'cool.mysite.com']);
		assert.strictEqual(Host.lookUp('cool.mysite.com').host, 'cool.mysite.com');

		await populateTree(Host, ['cool.mysite.com', '*.cool.mysite.com']);
		assert.strictEqual(Host.lookUp('cool.mysite.com').host, 'cool.mysite.com');
	});

	test('lookUpWildcardParent finds the wildcard even when the base domain already has its own plain host', async () => {
		await populateTree(Host, ['*.cool.mysite.com', 'cool.mysite.com']);
		const result = Host.lookUpWildcardParent('cool.mysite.com');
		assert.ok(result, 'Should find the sibling wildcard');
		assert.strictEqual(result.host, '*.cool.mysite.com');
	});

	test('lookUpWildcardParent returns undefined when there is no wildcard sibling', async () => {
		await populateTree(Host, ['cool.mysite.com']);
		assert.strictEqual(Host.lookUpWildcardParent('cool.mysite.com'), undefined);
	});

	test('lookUpWildcardParent returns undefined for an unrelated host', async () => {
		await populateTree(Host, ['*.cool.mysite.com']);
		assert.strictEqual(Host.lookUpWildcardParent('other.example.com'), undefined);
	});
});

/**
 * Tests for the exact fallback combination used by
 * routes/host.js's GET /wildcard-parent/:item (and, via hostMatchWildcard(),
 * the host create/edit form's "Parent Wildcard" option) -- lookUp() first
 * (handles a brand-new subdomain that has no leaf of its own yet), falling
 * back to lookUpWildcardParent() only when lookUp() didn't resolve to a
 * wildcard (handles an ALREADY-EXISTING host, which lookUp() would resolve
 * to its own record). Regression coverage for the edit-form bug where the
 * "Parent Wildcard" option stayed permanently greyed out for an existing
 * host, because the route only ever tried lookUp().
 */
describe('Host wildcard-parent route fallback (lookUp then lookUpWildcardParent)', () => {

	let Host;

	before(async () => {
		Host = createMockHostClassWithWildcardParentFix();
	});

	function findWildcardParent(host){
		let match = Host.lookUp(host);
		if(!match || !match.is_wildcard) match = Host.lookUpWildcardParent(host);
		return (match && match.is_wildcard) ? match : null;
	}

	test('finds the wildcard for a brand-new subdomain that was never created', async () => {
		await populateTree(Host, ['*.cool.mysite.com']);
		const result = findWildcardParent('newthing.cool.mysite.com');
		assert.ok(result);
		assert.strictEqual(result.host, '*.cool.mysite.com');
	});

	test('finds the wildcard for the wildcard\'s own base domain, whether or not it is already a plain host', async () => {
		await populateTree(Host, ['*.cool.mysite.com']);
		assert.strictEqual(findWildcardParent('cool.mysite.com').host, '*.cool.mysite.com');

		await populateTree(Host, ['*.cool.mysite.com', 'cool.mysite.com']);
		assert.strictEqual(findWildcardParent('cool.mysite.com').host, '*.cool.mysite.com');
	});

	test('returns null when the host has no wildcard sibling at all', async () => {
		await populateTree(Host, ['cool.mysite.com']);
		assert.strictEqual(findWildcardParent('cool.mysite.com'), null);
	});
});

/**
 * Same mock shape as createMockHostClass() above, plus the parent-record
 * stamp in the tree-population loop and the lookUpWildcardParent() method --
 * both copied from the real implementation in models/host.js.
 */
function createMockHostClassWithWildcardParentFix() {
	return class MockHost {
		static lookUpObj = {};

		static lookUp(host) {
			let place = this.lookUpObj;
			let last_resort = {};
			let parent = undefined;

			for(let fragment of host.split('.').reverse()){
				parent = place;
				if(place['**']) last_resort = place['**'];
				if({...last_resort, ...place}[fragment]){
					place = {...last_resort, ...place}[fragment];
				}else if(place['*']){
					place = place['*']
				}else if(last_resort){
					place = last_resort;
				}
			}

			if(place && place['#record']) return place['#record'];
			if(parent && parent['*'] && parent['*']['#record']) return parent['*']['#record'];
		}

		static lookUpWildcardParent(host) {
			let place = this.lookUpObj;
			for(let fragment of host.split('.').reverse()){
				if(!place[fragment]) return undefined;
				place = place[fragment];
			}
			if(place['*'] && place['*']['#record']) return place['*']['#record'];
		}
	};
}

async function populateTree(Host, hosts) {
	Host.lookUpObj = {};

	for(let host of hosts){
		let fragments = host.split('.');
		let pointer = Host.lookUpObj;

		while(fragments.length){
			let fragment = fragments.pop();

			if(!pointer[fragment]){
				pointer[fragment] = {};
			}

			if(fragments.length === 0){
				// is_wildcard mirrors the real Host model's own field (set
				// whenever a host is DNS-01 wildcard-issued, i.e. starts with
				// "*."), needed by tests that check it the same way the real
				// /wildcard-parent/:item route does.
				pointer[fragment]['#record'] = {host, is_wildcard: host.startsWith('*.')};

				if(fragment === '*' && !pointer['#record']){
					pointer['#record'] = pointer[fragment]['#record'];
				}
			}

			pointer = pointer[fragment];
		}
	}
}

/**
 * Creates a mock Host class with just the lookUp functionality
 * This allows us to test the algorithm without Redis dependencies
 */
function createMockHostClass() {
	return class MockHost {
		static lookUpObj = {};
		static __lookUpIsReady = false;

		static lookUp(host) {
			// This is the exact implementation from models/host.js lines 324-357
			let place = this.lookUpObj;
			let last_resort = {};

			for(let fragment of host.split('.').reverse()){
				if(place['**']) last_resort = place['**'];

				if({...last_resort, ...place}[fragment]){
					place = {...last_resort, ...place}[fragment];
				}else if(place['*']){
					place = place['*']
				}else if(last_resort){
					place = last_resort;
				}
			}

			if(place && place['#record']) return place['#record'];
		}
	};
}

/**
 * Populates the mock Host class with test data
 * Builds the lookup tree structure based on test cases from models/host.js
 */
async function populateTestData(Host) {
	// Test data based on the commented test cases in models/host.js
	const testHosts = [
		'payments.718it.biz',
		'payments.**',
		'**.exmaple.com',
		'stan.test.vm42.com',
		'test.vm42.com',
		'*.test.vm42.com',
		'info.*.users.718it.biz',
		'test.*.*.718it.net',
		'test1.exmaple.com',
		'*.exmaple.com',
		'info.**',
		'718it.biz',
	];

	Host.lookUpObj = {};

	for(let host of testHosts){
		let fragments = host.split('.');
		let pointer = Host.lookUpObj;

		while(fragments.length){
			let fragment = fragments.pop();

			if(!pointer[fragment]){
				pointer[fragment] = {};
			}

			if(fragments.length === 0){
				pointer[fragment]['#record'] = {host};
			}

			pointer = pointer[fragment];
		}
	}

	Host.__lookUpIsReady = true;
}
