'use strict';

const assert = require('node:assert');
const {DnsApi} = require('../../models/dns_provider/common');

/**
 * DNS Provider Contract Test Helper
 *
 * This module provides a contract test suite that validates a DNS provider
 * implementation meets all requirements. Use this when adding new DNS providers
 * to ensure they implement the required interface correctly.
 *
 * Required static properties:
 * - _keyMap: Object defining required API credentials/config
 * - displayName: String for UI display
 * - displayIconHtml: SVG markup for provider icon
 * - displayIconUni: Unicode icon fallback
 *
 * Required instance methods:
 * - listDomains(): Returns array of {domain, zoneId}
 * - getRecords(domain, options): Returns array of DNS records
 * - createRecord(domain, options): Creates a record, returns created record
 * - deleteRecords(domain, options): Deletes matching records
 *
 * Required behavior:
 * - Must extend DnsApi base class
 * - Must throw errors.unauthorized() on auth failures
 * - Must implement __apiKeyMap for key translation
 * - Must validate record types via __typeCheck
 */

/**
 * Validates a DNS provider class meets the contract
 *
 * @param {Class} ProviderClass - The DNS provider class to validate
 * @param {Object} mockCredentials - Mock credentials for testing
 * @returns {void}
 * @throws {AssertionError} If provider doesn't meet contract
 */
function validateDnsProviderContract(ProviderClass, mockCredentials) {

	// Test 1: Must extend DnsApi
	assert.ok(
		ProviderClass.prototype instanceof DnsApi,
		`${ProviderClass.name} must extend DnsApi base class`
	);

	// Test 2: Must have static _keyMap
	assert.ok(
		ProviderClass._keyMap,
		`${ProviderClass.name} must define static _keyMap`
	);

	assert.strictEqual(
		typeof ProviderClass._keyMap,
		'object',
		`${ProviderClass.name}._keyMap must be an object`
	);

	// Test 3: Must have display properties
	assert.ok(
		ProviderClass.displayName,
		`${ProviderClass.name} must define static displayName`
	);

	assert.ok(
		ProviderClass.displayIconHtml,
		`${ProviderClass.name} must define static displayIconHtml`
	);

	assert.ok(
		ProviderClass.displayIconUni,
		`${ProviderClass.name} must define static displayIconUni`
	);

	// Test 4: Can be instantiated
	let instance;
	assert.doesNotThrow(
		() => {
			instance = new ProviderClass(mockCredentials);
		},
		`${ProviderClass.name} must be instantiable with mock credentials`
	);

	// Test 5: Must have required methods
	const requiredMethods = [
		'listDomains',
		'getRecords',
		'createRecord',
		'deleteRecords'
	];

	for(let method of requiredMethods) {
		assert.strictEqual(
			typeof instance[method],
			'function',
			`${ProviderClass.name} must implement ${method}() method`
		);
	}

	// Test 6: Must have __apiKeyMap for key translation
	assert.ok(
		instance.hasOwnProperty('__apiKeyMap') || instance.constructor.prototype.hasOwnProperty('__apiKeyMap'),
		`${ProviderClass.name} must define __apiKeyMap property`
	);

	// Test 7: Must have __typeCheck method (inherited or overridden)
	assert.strictEqual(
		typeof instance.__typeCheck,
		'function',
		`${ProviderClass.name} must have __typeCheck method`
	);

	// Test 8: Must have error methods (inherited from DnsApi)
	assert.ok(
		instance.errors,
		`${ProviderClass.name} must have errors object`
	);

	assert.strictEqual(
		typeof instance.errors.unauthorized,
		'function',
		`${ProviderClass.name} must have errors.unauthorized method`
	);

	assert.strictEqual(
		typeof instance.errors.invalidInput,
		'function',
		`${ProviderClass.name} must have errors.invalidInput method`
	);

	assert.strictEqual(
		typeof instance.errors.other,
		'function',
		`${ProviderClass.name} must have errors.other method`
	);

	// Test 9: info() method should return expected structure
	const info = ProviderClass.info();
	assert.ok(info.displayName, 'info() must include displayName');
	assert.ok(info.displayIconHtml, 'info() must include displayIconHtml');
	assert.ok(info.displayIconUni, 'info() must include displayIconUni');
	assert.ok(info.fields, 'info() must include fields');

	// Test 10: toJSON() should work
	const json = instance.toJSON();
	assert.ok(json.displayName, 'toJSON() must include displayName');

	return instance;
}

/**
 * Validates method signatures for a DNS provider instance
 *
 * @param {Object} instance - Instance of DNS provider
 * @param {Object} mockDomain - Mock domain object with {domain, zoneId}
 * @returns {void}
 */
function validateMethodSignatures(instance, mockDomain = {domain: 'example.com', zoneId: 'mock-zone'}) {

	const className = instance.constructor.name;

	// These tests just verify the methods accept the expected parameters
	// and return promises (actual API calls would require real credentials)

	// listDomains() should return a promise
	const listDomainsResult = instance.listDomains();
	assert.ok(
		listDomainsResult instanceof Promise,
		`${className}.listDomains() must return a Promise`
	);

	// getRecords(domain, options) should return a promise
	const getRecordsResult = instance.getRecords(mockDomain, {type: 'A'});
	assert.ok(
		getRecordsResult instanceof Promise,
		`${className}.getRecords() must return a Promise`
	);

	// createRecord(domain, options) should return a promise
	const createRecordResult = instance.createRecord(mockDomain, {
		type: 'TXT',
		name: 'test',
		data: 'test-value'
	});
	assert.ok(
		createRecordResult instanceof Promise,
		`${className}.createRecord() must return a Promise`
	);

	// deleteRecords(domain, options) should return a promise
	const deleteRecordsResult = instance.deleteRecords(mockDomain, {
		type: 'TXT',
		name: 'test'
	});
	assert.ok(
		deleteRecordsResult instanceof Promise,
		`${className}.deleteRecords() must return a Promise`
	);
}

/**
 * Validates __parseOptions and __parseRes behavior
 *
 * @param {Object} instance - Instance of DNS provider
 * @returns {void}
 */
function validateKeyMapping(instance) {
	const className = instance.constructor.name;

	// Test __parseOptions normalizes keys
	if(Object.keys(instance.__apiKeyMap).length > 0) {
		const testOptions = {type: 'A'};

		// Add a class key that should be mapped to API key
		const [apiKey, clsKey] = Object.entries(instance.__apiKeyMap)[0];
		testOptions[clsKey] = 'test-value';

		const parsed = instance.__parseOptions(testOptions);

		assert.ok(
			parsed.hasOwnProperty(apiKey),
			`${className}.__parseOptions() should map '${clsKey}' to '${apiKey}'`
		);

		assert.strictEqual(
			parsed[clsKey],
			undefined,
			`${className}.__parseOptions() should remove class key '${clsKey}' after mapping`
		);
	}

	// Test __parseRes normalizes response keys
	const testResponse = [];
	const [apiKey, clsKey] = Object.entries(instance.__apiKeyMap)[0] || ['content', 'data'];
	testResponse.push({[apiKey]: 'test-value', name: 'test.example.com'});

	const parsedRes = instance.__parseRes(testResponse);

	if(Object.keys(instance.__apiKeyMap).length > 0) {
		assert.ok(
			parsedRes[0].hasOwnProperty(clsKey),
			`${className}.__parseRes() should map '${apiKey}' to '${clsKey}'`
		);
	}
}

/**
 * Validates type checking behavior
 *
 * @param {Object} instance - Instance of DNS provider
 * @returns {void}
 */
function validateTypeChecking(instance) {
	const className = instance.constructor.name;

	const validTypes = ['A', 'MX', 'CNAME', 'ALIAS', 'TXT', 'NS', 'AAAA', 'SRV', 'TLSA', 'CAA'];

	// Valid types should not throw
	for(let type of validTypes) {
		assert.doesNotThrow(
			() => instance.__typeCheck(type),
			`${className}.__typeCheck() should accept valid type '${type}'`
		);
	}

	// Invalid type should throw
	assert.throws(
		() => instance.__typeCheck('INVALID'),
		/Invalid.*type/i,
		`${className}.__typeCheck() should reject invalid types`
	);
}

module.exports = {
	validateDnsProviderContract,
	validateMethodSignatures,
	validateKeyMapping,
	validateTypeChecking
};
