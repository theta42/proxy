'use strict';
const { describe, test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const net = require('net');

function checkRedis() {
    return new Promise((resolve) => {
        const socket = net.createConnection(6379, '127.0.0.1');
        socket.once('connect', () => { socket.end(); resolve(true); });
        socket.once('error', () => { resolve(false); });
    });
}

describe('DnsProvider Vault Integration', async () => {
    const redisRunning = await checkRedis();
    if (!redisRunning) {
        test('skipped when Redis is not running', (t) => {
            t.skip('Redis is not running on 127.0.0.1:6379');
        });
        return;
    }

    const baoConf = require('@simpleworkjs/bao-conf');
    const Table = require('../../models/index');
    const DnsProvider = Table.models.DnsProvider;
    const DuckDns = require('../../models/dns_provider/duckdns');

    let originalSet, originalGet, originalRequest;

    beforeEach(() => {
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

        assert.strictEqual(baoConf.set.mock.callCount(), 1);
        const [path, secrets] = baoConf.set.mock.calls[0].arguments;
        
        assert.strictEqual(path, `proxy/dns-providers/${instance.id}`);
        assert.deepStrictEqual(secrets, { token: 'super-secret-vault-token' });

        assert.strictEqual(instance.token, 'super-secret-vault-token');
        
        const fetched = await DnsProvider.get(instance.id);
        assert.strictEqual(fetched.token, 'super-secret-vault-token');
    });
});
