# Test Suite

This project uses Node.js built-in test runner (requires Node 18+). No external testing dependencies required.

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch
```

## Test Structure

```
test/
├── unit/              # Unit tests for isolated components
│   ├── callback_queue.test.js
│   ├── host_lookup.test.js
│   └── unix_socket.test.js
├── integration/       # Integration tests for complex interactions
│   └── dns_provider.test.js
└── helpers/           # Test utilities and contracts
    └── dns_provider_contract.js
```

## What We Test

### Unit Tests

**callback_queue.test.js**
- Callback registration and invocation
- Multiple callbacks with arguments
- Error handling

**host_lookup.test.js**
- Host lookup tree algorithm
- Wildcard matching (single and double)
- Exact match priority
- Edge cases (no match, empty input, etc.)

**unix_socket.test.js**
- Unix socket server creation
- JSON message parsing
- Partial data buffering
- Multiple connections
- Error handling

### Integration Tests

**dns_provider.test.js**
- DNS provider contract compliance
- All existing providers (CloudFlare, DigitalOcean, PorkBun)
- Method signatures
- Key mapping
- Type validation

## Adding a New DNS Provider

When you add a new DNS provider, you MUST add tests to ensure it meets the contract:

1. Create your provider class extending `DnsApi` in `models/dns_provider/yourprovider.js`

2. Add a test block in `test/integration/dns_provider.test.js`:

```javascript
describe('YourProvider Provider', () => {
    const YourProvider = require('../../models/dns_provider/yourprovider');

    test('should meet DNS provider contract', () => {
        const mockCredentials = {api_key: 'mock-key'};
        const instance = validateDnsProviderContract(YourProvider, mockCredentials);
        assert.ok(instance, 'YourProvider should be instantiated');
    });

    test('should have correct _keyMap structure', () => {
        // Test your specific credential requirements
        assert.ok(YourProvider._keyMap.api_key);
        assert.strictEqual(YourProvider._keyMap.api_key.type, 'string');
        assert.strictEqual(YourProvider._keyMap.api_key.isRequired, true);
    });

    test('should have valid method signatures', () => {
        const instance = new YourProvider({api_key: 'mock'});
        validateMethodSignatures(instance);
    });

    test('should validate key mapping', () => {
        const instance = new YourProvider({api_key: 'mock'});
        validateKeyMapping(instance);
    });

    test('should validate type checking', () => {
        const instance = new YourProvider({api_key: 'mock'});
        validateTypeChecking(instance);
    });
});
```

3. Run tests to verify compliance:

```bash
npm run test:integration
```

## DNS Provider Contract

All DNS providers must:

1. Extend `DnsApi` base class
2. Define static `_keyMap` with required credentials
3. Define static display properties: `displayName`, `displayIconHtml`, `displayIconUni`
4. Implement required methods:
   - `listDomains()` - Returns array of `{domain, zoneId}`
   - `getRecords(domain, options)` - Returns array of DNS records
   - `createRecord(domain, options)` - Creates a record
   - `deleteRecords(domain, options)` - Deletes matching records
5. Define `__apiKeyMap` to translate between class keys and API keys
6. Implement or inherit `__typeCheck()` for record type validation
7. Throw appropriate errors from `this.errors` object

## CI/CD Integration

Tests can be run in GitHub Actions, GitLab CI, or any CI/CD system:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test
```

## Philosophy

We test **custom logic**, not third-party code:
- YES: Test our host lookup algorithm
- YES: Test our socket buffering logic
- YES: Test DNS provider contracts
- NO: Don't test Express.js routing
- NO: Don't test the Redis ORM
- NO: Don't test external DNS APIs (use mocks)

## Notes

- Tests use Node's built-in `node:test` and `node:assert` modules
- No external testing framework needed
- Tests are fast and run in parallel by default
- Mock external services (Redis, DNS APIs) to avoid network calls
- Focus on testing business logic, not infrastructure
