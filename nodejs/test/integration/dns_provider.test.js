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

	describe('DuckDNS Provider', () => {
		const DuckDns = require('../../models/dns_provider/duckdns');

		test('should meet DNS provider contract', () => {
			const mockCredentials = {token: 'mock-token', subdomains: 'mockhost'};
			const instance = validateDnsProviderContract(DuckDns, mockCredentials);

			assert.ok(instance, 'DuckDNS provider should be instantiated');
		});

		test('should have correct _keyMap structure', () => {
			assert.ok(DuckDns._keyMap.token, 'Should require token');
			assert.strictEqual(DuckDns._keyMap.token.type, 'string');
			assert.strictEqual(DuckDns._keyMap.token.isRequired, true);
			assert.strictEqual(DuckDns._keyMap.token.isPrivate, true);
			assert.ok(DuckDns._keyMap.subdomains, 'Should require subdomains');
			assert.strictEqual(DuckDns._keyMap.subdomains.isRequired, true);
		});

		test('should have valid method signatures', () => {
			const instance = new DuckDns({token: 'mock-token', subdomains: 'mockhost'});
			validateMethodSignatures(instance);
		});

		test('should validate key mapping', () => {
			const instance = new DuckDns({token: 'mock-token', subdomains: 'mockhost'});
			validateKeyMapping(instance);
		});

		test('should validate type checking', () => {
			const instance = new DuckDns({token: 'mock-token', subdomains: 'mockhost'});
			validateTypeChecking(instance);
		});

		test('rejects non A/AAAA/TXT record creation with a clear error', async () => {
			const instance = new DuckDns({token: 'mock-token', subdomains: 'mockhost'});
			await assert.rejects(
				() => instance.createRecord({domain: 'mockhost.duckdns.org'}, {type: 'CNAME', data: 'example.com'}),
				/DuckDNS only supports A, AAAA and TXT records/
			);
		});

		test('__label strips the .duckdns.org suffix', () => {
			const instance = new DuckDns({token: 'mock-token', subdomains: 'mockhost'});
			assert.strictEqual(instance.__label({domain: 'mockhost.duckdns.org'}), 'mockhost');
		});
	});
});

describe('DNS Provider _keyMap field names', () => {
	// Regression test for the DuckDNS `domains` field bug: DnsProvider merges
	// `{...DnsProvider._keyMap, ...Provider._keyMap}` (see __intraModel in
	// ../../models/dns_provider.js), so a provider field with the same name as
	// one of DnsProvider's own (created_by, updated_by, name, dnsProvider,
	// domains, id — see DnsProvider._keyMap) silently overwrites it. That
	// happened with a DuckDNS field named `domains`, which replaced the
	// `domains` relation (rel: 'many' to Domain) and broke updateDomains()
	// with "this.domains.map is not a function". Every registered provider's
	// _keyMap must avoid these names.
	//
	// This checks each provider class directly rather than going through
	// ../../models/dns_provider.js, which pulls in the Redis-backed Table
	// base class (model-redis) — not needed for a static field-name check,
	// and not guaranteed to have a reachable Redis in every test environment.
	const RESERVED = ['created_by', 'updated_by', 'name', 'dnsProvider', 'domains', 'id'];
	const providerClasses = {
		Cloudflare: require('../../models/dns_provider/cloudflare'),
		DigitalOcean: require('../../models/dns_provider/digitalocean'),
		PorkBun: require('../../models/dns_provider/porkbun'),
		DuckDns: require('../../models/dns_provider/duckdns'),
	};

	for(const [name, ProviderClass] of Object.entries(providerClasses)){
		test(`${name} does not define a reserved DnsProvider field`, () => {
			const collisions = Object.keys(ProviderClass._keyMap).filter(key => RESERVED.includes(key));
			assert.deepStrictEqual(collisions, [], `${name} redefines reserved field(s): ${collisions.join(', ')}`);
		});
	}
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
