const { describe, test, beforeEach, afterEach, after, mock } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const baoConf = require('@simpleworkjs/bao-conf');
const Table = require('../../models/index');
const DnsProvider = Table.models.DnsProvider;
const DuckDns = require('../../models/dns_provider/duckdns');

describe('DnsProvider Vault Integration', () => {
    let originalSet, originalGet, originalRequest;

    after(async () => {
        if (Table._redis && Table._redis.quit) {
            await Table._redis.quit();
        }
    });

    beforeEach(() => {
        // Mock baoConf
        originalSet = baoConf.set;
        originalGet = baoConf.get;
        originalRequest = baoConf.request;

        const vaultStore = {};
        baoConf.set = mock.fn(async (path, data) => { vaultStore[path] = data; return true; });
        baoConf.get = mock.fn(async (path) => vaultStore[path] || {});
        baoConf.request = mock.fn(async () => ({}));
        
        mock.method(DuckDns.prototype, 'listDomains', async () => []);
        mock.method(DnsProvider.prototype, 'updateDomains', async () => {});
    });

    afterEach(() => {
        baoConf.set = originalSet;
        baoConf.get = originalGet;
        baoConf.request = originalRequest;
        mock.restoreAll();
    });

    test('create() writes isPrivate keys to OpenBao and get() retrieves them', async () => {
        const payload = {
            name: 'My Duck',
            dnsProvider: 'DuckDns',
            token: 'super-secret-vault-token',
            subdomains: 'myduck',
            created_by: 'admin'
        };

        const instance = await DnsProvider.create(payload);

        // 1. Should have called OpenBao set
        assert.strictEqual(baoConf.set.mock.callCount(), 1);
        const [path, secrets] = baoConf.set.mock.calls[0].arguments;
        
        assert.strictEqual(path, `proxy/dns-providers/${instance.id}`);
        assert.deepStrictEqual(secrets, { token: 'super-secret-vault-token' });

        // 2. The returned instance should have the secret injected back
        assert.strictEqual(instance.token, 'super-secret-vault-token');
        
        // 3. get() should fetch public data from Redis and merge secrets from OpenBao
        // (baoConf.get is already mocked to return from vaultStore)
        const fetched = await DnsProvider.get(instance.id);
        assert.strictEqual(fetched.token, 'super-secret-vault-token');
    });
});
