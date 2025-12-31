'use strict';

const {describe, test} = require('node:test');
const assert = require('node:assert');
const {
	validateDnsProviderContract,
	validateMethodSignatures,
	validateKeyMapping,
	validateTypeChecking
} = require('../helpers/dns_provider_contract');

/**
 * DNS Provider Integration Tests
 *
 * These tests validate that each DNS provider implementation meets
 * the required contract. When adding a new DNS provider:
 *
 * 1. Add a new describe block for your provider
 * 2. Import your provider class
 * 3. Run the contract validation tests
 * 4. Add any provider-specific tests as needed
 *
 * The contract tests will verify:
 * - Class extends DnsApi
 * - Required static properties are defined
 * - Required methods are implemented
 * - Error handling is correct
 * - Key mapping works correctly
 * - Type validation is implemented
 */

describe('DNS Provider Contract Compliance', () => {

	describe('CloudFlare Provider', () => {
		const CloudFlare = require('../../models/dns_provider/cloudflare');

		test('should meet DNS provider contract', () => {
			const mockCredentials = {token: 'mock-token-for-testing'};
			const instance = validateDnsProviderContract(CloudFlare, mockCredentials);

			assert.ok(instance, 'CloudFlare provider should be instantiated');
		});

		test('should have correct _keyMap structure', () => {
			assert.ok(CloudFlare._keyMap.token, 'Should require token');
			assert.strictEqual(CloudFlare._keyMap.token.type, 'string');
			assert.strictEqual(CloudFlare._keyMap.token.isRequired, true);
			assert.strictEqual(CloudFlare._keyMap.token.isPrivate, true);
		});

		test('should have correct display properties', () => {
			assert.strictEqual(CloudFlare.displayName, 'CloudFlare');
			assert.ok(CloudFlare.displayIconHtml.includes('svg'));
			assert.ok(CloudFlare.displayIconUni);
		});

		test('should map content to data', () => {
			const instance = new CloudFlare({token: 'mock'});
			assert.deepStrictEqual(instance.__apiKeyMap, {'content': 'data'});
		});

		test('should have valid method signatures', () => {
			const instance = new CloudFlare({token: 'mock'});
			validateMethodSignatures(instance);
		});

		test('should validate key mapping', () => {
			const instance = new CloudFlare({token: 'mock'});
			validateKeyMapping(instance);
		});

		test('should validate type checking', () => {
			const instance = new CloudFlare({token: 'mock'});
			validateTypeChecking(instance);
		});
	});

	describe('DigitalOcean Provider', () => {
		const DigitalOcean = require('../../models/dns_provider/digitalocean');

		test('should meet DNS provider contract', () => {
			const mockCredentials = {token: 'mock-token-for-testing'};
			const instance = validateDnsProviderContract(DigitalOcean, mockCredentials);

			assert.ok(instance, 'DigitalOcean provider should be instantiated');
		});

		test('should have correct _keyMap structure', () => {
			assert.ok(DigitalOcean._keyMap.token, 'Should require token');
			assert.strictEqual(DigitalOcean._keyMap.token.type, 'string');
			assert.strictEqual(DigitalOcean._keyMap.token.isRequired, true);
		});

		test('should have valid method signatures', () => {
			const instance = new DigitalOcean({token: 'mock'});
			validateMethodSignatures(instance);
		});

		test('should validate key mapping', () => {
			const instance = new DigitalOcean({token: 'mock'});
			validateKeyMapping(instance);
		});

		test('should validate type checking', () => {
			const instance = new DigitalOcean({token: 'mock'});
			validateTypeChecking(instance);
		});
	});

	describe('PorkBun Provider', () => {
		const PorkBun = require('../../models/dns_provider/porkbun');

		test('should meet DNS provider contract', () => {
			const mockCredentials = {
				apiKey: 'mock-api-key',
				secretApiKey: 'mock-secret-key'
			};
			const instance = validateDnsProviderContract(PorkBun, mockCredentials);

			assert.ok(instance, 'PorkBun provider should be instantiated');
		});

		test('should have correct _keyMap structure', () => {
			assert.ok(PorkBun._keyMap.apiKey, 'Should require apiKey');
			assert.ok(PorkBun._keyMap.secretApiKey, 'Should require secretApiKey');
			assert.strictEqual(PorkBun._keyMap.apiKey.type, 'string');
			assert.strictEqual(PorkBun._keyMap.apiKey.isRequired, true);
			assert.strictEqual(PorkBun._keyMap.secretApiKey.type, 'string');
			assert.strictEqual(PorkBun._keyMap.secretApiKey.isRequired, true);
		});

		test('should have valid method signatures', () => {
			const instance = new PorkBun({
				apiKey: 'mock-api-key',
				secretApiKey: 'mock-secret-key'
			});
			validateMethodSignatures(instance);
		});

		test('should validate key mapping', () => {
			const instance = new PorkBun({
				apiKey: 'mock-api-key',
				secretApiKey: 'mock-secret-key'
			});
			validateKeyMapping(instance);
		});

		test('should validate type checking', () => {
			const instance = new PorkBun({
				apiKey: 'mock-api-key',
				secretApiKey: 'mock-secret-key'
			});
			validateTypeChecking(instance);
		});
	});
});

/**
 * Example: How to add tests for a new DNS provider
 *
 * describe('NewProvider Provider', () => {
 *     const NewProvider = require('../../models/dns_provider/newprovider');
 *
 *     test('should meet DNS provider contract', () => {
 *         const mockCredentials = {api_key: 'mock-key'};
 *         const instance = validateDnsProviderContract(NewProvider, mockCredentials);
 *         assert.ok(instance, 'NewProvider should be instantiated');
 *     });
 *
 *     test('should have correct _keyMap structure', () => {
 *         // Verify your provider's specific credential requirements
 *         assert.ok(NewProvider._keyMap.api_key);
 *     });
 *
 *     test('should have valid method signatures', () => {
 *         const instance = new NewProvider({api_key: 'mock'});
 *         validateMethodSignatures(instance);
 *     });
 *
 *     test('should validate key mapping', () => {
 *         const instance = new NewProvider({api_key: 'mock'});
 *         validateKeyMapping(instance);
 *     });
 *
 *     test('should validate type checking', () => {
 *         const instance = new NewProvider({api_key: 'mock'});
 *         validateTypeChecking(instance);
 *     });
 * });
 */
