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
