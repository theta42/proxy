# Proxy

A reverse proxy and HTTPS termination service using OpenResty/nginx with a management API and web GUI.

**Documentation:** [https://theta42.github.io/proxy/](https://theta42.github.io/proxy/)

## Features

- Automated HTTPS/SSL certificate management via Let's Encrypt
- Support for HTTP-01 (auto-ssl) and DNS-01 (wildcard) ACME challenges
- Multiple DNS provider integrations (CloudFlare, DigitalOcean, PorkBun)
- Wildcard SSL certificate support with automatic renewal
- Dynamic host routing with wildcard domain matching (*, **)
- Web-based management interface
- RESTful API for automation
- User authentication and management
- Unix socket-based host lookup for high-performance routing

## Requirements

- Node.js 18+ (tested with 18.x, 20.x, 22.x)
- OpenResty (nginx with Lua support)
- Redis
- Modern Linux distribution (tested on Ubuntu 20.04+, Debian 11+)
- Inbound internet access for Let's Encrypt validation
- Root access (required for user management features)

## Quick Install

An automated installer is available for modern Debian-based systems:

```bash
wget -O - https://raw.githubusercontent.com/theta42/proxy/master/ops/install.sh | sudo bash
```

This installer will:
- Install Node.js 20.x
- Install OpenResty and required dependencies
- Install and configure Redis
- Set up SSL fallback certificates
- Install Lua dependencies (lua-resty-auto-ssl, luasocket)
- Clone and install the proxy application
- Configure systemd service
- Start the proxy service

## Manual Installation

For manual installation or other distributions, see the detailed steps below.

### System Dependencies

**Ubuntu/Debian:**
```bash
apt install libpam0g-dev build-essential redis-server luarocks -y
```

**Node.js 20.x:**
```bash
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
apt update && apt install nodejs -y
```

**OpenResty:**
```bash
wget -O - https://openresty.org/package/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/openresty.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/openresty.list
apt update && apt install openresty -y
```

**Lua Dependencies:**
```bash
luarocks install lua-resty-auto-ssl
luarocks install luasocket
```

### SSL Configuration

Create fallback SSL certificates:
```bash
mkdir -p /etc/ssl/
openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
  -subj '/CN=sni-support-required-for-valid-ssl' \
  -keyout /etc/ssl/resty-auto-ssl-fallback.key \
  -out /etc/ssl/resty-auto-ssl-fallback.crt
```

### OpenResty Configuration

Configuration files are provided in `ops/nginx_conf/`:
- `nginx.conf` - Main nginx configuration
- `autossl.conf` - Auto-SSL configuration for Let's Encrypt HTTP-01
- `proxy.conf` - Proxy server configuration with host lookup
- `targetinfo.lua` - Lua module for host lookup via Unix socket

Copy these files to `/etc/openresty/`:
```bash
mkdir -p /etc/openresty/sites-enabled/
cp ops/nginx_conf/nginx.conf /etc/openresty/nginx.conf
cp ops/nginx_conf/autossl.conf /etc/openresty/autossl.conf
cp ops/nginx_conf/proxy.conf /etc/openresty/sites-enabled/000-proxy
cp ops/nginx_conf/targetinfo.lua /usr/local/openresty/lualib/targetinfo.lua
```

### Application Setup

Clone and install:
```bash
cd /var/www
git clone https://github.com/theta42/proxy.git
cd proxy/nodejs
npm install
```

Create systemd service:
```bash
cp ops/proxy.service /etc/systemd/system/proxy.service
systemctl daemon-reload
systemctl enable proxy.service
systemctl start proxy.service
```

## DNS Provider Configuration

For wildcard SSL certificates, configure a DNS provider via the web UI or API:

**Supported providers:**
- **CloudFlare** - Requires API token
- **DigitalOcean** - Requires API token
- **PorkBun** - Requires API key and secret API key

Once configured, create a wildcard host (e.g., `*.example.com`) and the system will automatically request and manage the DNS-01 challenge certificate.

## Architecture

The system consists of three main components:

1. **OpenResty/Nginx** - Frontend proxy with Lua-based routing
   - Handles SSL termination via lua-resty-auto-ssl
   - Queries Node.js backend via Unix socket for host routing
   - Proxies requests to configured backend servers

2. **Node.js API** - Backend management and control plane
   - RESTful API for host/user/DNS management
   - Wildcard SSL certificate orchestration
   - Host lookup tree with wildcard matching
   - User authentication and authorization

3. **Redis** - Data store
   - Host configurations
   - User accounts and tokens
   - SSL certificate storage
   - Domain and DNS provider configurations

## Host Lookup System

The proxy supports sophisticated domain matching:
- **Exact match**: `example.com` matches only `example.com`
- **Single wildcard**: `*.example.com` matches `sub.example.com` but not `deep.sub.example.com`
- **Double wildcard**: `**.example.com` matches any depth (`sub.example.com`, `deep.sub.example.com`, etc.)
- **Mixed wildcards**: `api.*.example.com` matches `api.v1.example.com`, `api.v2.example.com`, etc.

Priority: Exact match > Single wildcard > Double wildcard

## Development

**Running locally:**
```bash
cd nodejs
npm install
npm run dev  # Runs with nodemon for auto-reload
```

**Running tests:**
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:watch    # Watch mode for development
```

Tests use Node.js built-in test runner (requires Node 18+).

## API Documentation

See [API Documentation](nodejs/api.md) for complete API reference.

## Contributing

Pull requests are welcome. The project uses GitHub Actions for CI/CD:
- Tests run automatically on all PRs
- All tests must pass before merging to master
- Tests run on Node.js 18.x, 20.x, and 22.x

## License

MIT - See LICENSE file for details.

## Project Structure

```
proxy/
├── nodejs/              # Node.js backend application
│   ├── bin/            # Entry point (www)
│   ├── models/         # Data models (Host, User, DNS providers)
│   ├── routes/         # API routes
│   ├── services/       # Background services (host lookup, scheduler)
│   ├── middleware/     # Express middleware
│   ├── utils/          # Utility functions
│   ├── public/         # Static web assets
│   ├── views/          # EJS templates
│   └── test/           # Test suite
├── ops/                # Operations and deployment
│   ├── nginx_conf/     # OpenResty configuration files
│   ├── install.sh      # Automated installer
│   └── proxy.service   # Systemd service definition
└── .github/workflows/  # CI/CD workflows
```
