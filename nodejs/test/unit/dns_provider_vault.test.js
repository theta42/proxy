const { describe, test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const baoConf = require('@simpleworkjs/bao-conf');
const Table = require('../../models/index');
const DnsProvider = Table.models.DnsProvider;
const DuckDns = require('../../models/dns_provider/duckdns');

describe('DnsProvider Vault Integration', () => {
    let originalSet, originalGet, originalRequest;

    beforeEach(() => {
        // Mock baoConf
        originalSet = baoConf.set;
        originalGet = baoConf.get;
        originalRequest = baoConf.request;

        const vaultStore = {};
        const redisStore = {};

        baoConf.set = mock.fn(async (path, data) => { vaultStore[path] = data; return true; });
        baoConf.get = mock.fn(async (path) => vaultStore[path] || {});
        baoConf.request = mock.fn(async () => ({}));
        
        mock.method(DuckDns.prototype, 'listDomains', async () => []);
        mock.method(DnsProvider.prototype, 'updateDomains', async () => {});

        // Mock Table persistence so unit tests run cleanly without an external Redis instance
        mock.method(Table, 'create', async function(data) {
            const id = data.id || crypto.randomBytes(8).toString('hex');
            const record = { ...data, id };
            redisStore[id] = record;
            const inst = new this(record);
            return inst;
        });

        mock.method(Table, 'get', async function(id) {
            if (!redisStore[id]) {
                const err = new Error('Entry not found');
                err.name = 'EntryNotFound';
                throw err;
            }
            return new this(redisStore[id]);
        });
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
