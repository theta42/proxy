---
layout: default
title: Contributing
---

# Contributing Guide

[← Back to Home](index.html)

Thank you for considering contributing to the Proxy project! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+ (18.x, 20.x, or 22.x recommended)
- Redis server
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/theta42/proxy.git
   cd proxy/nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start Redis** (if not already running)
   ```bash
   redis-server
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

   This starts the Node.js API with nodemon for auto-reload on file changes.

5. **Access the API**
   - API: `http://localhost:3000/api`
   - Web UI: `http://localhost:3000`

## Testing

The project uses Node.js built-in test runner (requires Node 18+).

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Test Structure

```
test/
├── unit/                       # Unit tests for isolated components
│   ├── callback_queue.test.js
│   ├── host_lookup.test.js
│   └── unix_socket.test.js
├── integration/                # Integration tests
│   └── dns_provider.test.js
└── helpers/                    # Test utilities
    └── dns_provider_contract.js
```

### Writing Tests

We test **custom logic**, not third-party libraries:

**DO test:**
- Host lookup algorithm
- Socket buffering logic
- DNS provider contracts
- Custom utility functions

**DON'T test:**
- Express.js routing
- Redis ORM
- External DNS APIs (use mocks instead)

### Adding DNS Provider Tests

When adding a new DNS provider, you **must** add contract tests:

```javascript
describe('NewProvider Provider', () => {
    const NewProvider = require('../../models/dns_provider/newprovider');

    test('should meet DNS provider contract', () => {
        const mockCredentials = {api_key: 'mock-key'};
        const instance = validateDnsProviderContract(NewProvider, mockCredentials);
        assert.ok(instance);
    });

    test('should have valid method signatures', () => {
        const instance = new NewProvider({api_key: 'mock'});
        validateMethodSignatures(instance);
    });

    test('should validate key mapping', () => {
        const instance = new NewProvider({api_key: 'mock'});
        validateKeyMapping(instance);
    });

    test('should validate type checking', () => {
        const instance = new NewProvider({api_key: 'mock'});
        validateTypeChecking(instance);
    });
});
```

See `test/integration/dns_provider.test.js` for examples.

## Code Style

### General Guidelines

- Use strict mode: `'use strict';`
- Use tabs for indentation
- Clear, descriptive variable names
- Comment complex logic
- No trailing whitespace

### File Organization

```javascript
'use strict';

// 1. Node.js built-ins
const fs = require('fs');
const path = require('path');

// 2. Third-party modules
const express = require('express');
const redis = require('redis');

// 3. Local modules
const {Host} = require('./models');
const middleware = require('./middleware/auth');

// 4. Code...
```

### Naming Conventions

- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `__privateMethod` (double underscore prefix)

## Project Structure

Understanding the codebase:

```
nodejs/
├── models/              # Data models (Host, User, DNS providers)
├── routes/              # API route handlers
├── services/            # Background services (lookup, scheduler)
├── middleware/          # Express middleware
├── utils/               # Utility functions
├── public/              # Static web assets
├── views/               # EJS templates
└── test/                # Test suite
```

## Pull Request Process

### Before Submitting

1. **Run tests** - Ensure all tests pass
   ```bash
   npm test
   ```

2. **Test locally** - Verify your changes work
   ```bash
   npm run dev
   ```

3. **Update documentation** - Keep docs in sync with code changes

4. **Commit messages** - Use clear, descriptive messages
   ```
   Add DNS provider for Route53

   - Implement Route53 DNS API client
   - Add contract tests for Route53
   - Update documentation with Route53 setup
   ```

### Submitting a PR

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make your changes**

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Open a Pull Request** on GitHub

### PR Requirements

- ✅ All tests must pass (CI/CD runs automatically)
- ✅ Tests run on Node.js 18.x, 20.x, and 22.x
- ✅ No merge conflicts with `master`
- ✅ Code follows project conventions
- ✅ New features include tests
- ✅ Documentation updated if needed

### CI/CD Process

When you open a PR:
1. GitHub Actions automatically runs tests
2. Tests execute on multiple Node.js versions
3. PR cannot be merged until all checks pass
4. Review from maintainers
5. Merge to master

## Adding Features

### Adding a DNS Provider

1. **Create provider file** in `models/dns_provider/yourprovider.js`

2. **Extend DnsApi base class**
   ```javascript
   const {DnsApi} = require('./common');

   class YourProvider extends DnsApi {
       static _keyMap = {
           api_key: {isRequired: true, type: 'string', isPrivate: true}
       };

       // Implement required methods
       async listDomains() { }
       async getRecords(domain, options) { }
       async createRecord(domain, options) { }
       async deleteRecords(domain, options) { }
   }
   ```

3. **Add to provider list** in `models/dns_provider.js`

4. **Add contract tests** in `test/integration/dns_provider.test.js`

5. **Test your provider**
   ```bash
   npm run test:integration
   ```

### Adding API Endpoints

1. **Add route** in appropriate file (`routes/`)
2. **Update API documentation** (`nodejs/api.md`)
3. **Test the endpoint** manually and add integration tests if needed

## Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/theta42/proxy/discussions)
- **Bug reports** Use [GitHub Issues](https://github.com/theta42/proxy/issues)
- **Security issues** Email maintainers directly (see package.json)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the project's technical direction

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

[← Back to Home](index.html) | [View on GitHub](https://github.com/theta42/proxy)
