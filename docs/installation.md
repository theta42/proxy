---
layout: default
title: Installation
---

# Installation Guide

[← Back to Home](index.html)

## Quick Install (Recommended)

For modern Debian-based systems (Ubuntu 20.04+, Debian 11+):

```bash
wget -O - https://raw.githubusercontent.com/theta42/proxy/master/ops/install.sh | sudo bash
```

This automated installer will:
- Install Node.js 20.x
- Install OpenResty and required dependencies
- Install and configure Redis
- Set up SSL fallback certificates
- Install Lua dependencies
- Clone and install the proxy application
- Configure systemd service
- Start the proxy service

## Manual Installation

### System Requirements

- Modern Linux distribution (Ubuntu 20.04+, Debian 11+, or equivalent)
- Root access
- Inbound internet access for Let's Encrypt validation
- Minimum 1GB RAM, 10GB disk space

### Step 1: Install Dependencies

**Ubuntu/Debian:**
```bash
apt install libpam0g-dev build-essential redis-server luarocks -y
```

### Step 2: Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
  sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | \
  sudo tee /etc/apt/sources.list.d/nodesource.list

apt update && apt install nodejs -y
```

Verify installation:
```bash
node --version  # Should show v20.x.x
npm --version
```

### Step 3: Install OpenResty

```bash
wget -O - https://openresty.org/package/pubkey.gpg | \
  sudo gpg --dearmor -o /usr/share/keyrings/openresty.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu $(lsb_release -sc) main" | \
  sudo tee /etc/apt/sources.list.d/openresty.list

apt update && apt install openresty -y
```

### Step 4: Install Lua Dependencies

```bash
luarocks install lua-resty-auto-ssl
luarocks install luasocket
```

### Step 5: SSL Configuration

Create fallback SSL certificates:

```bash
mkdir -p /etc/ssl/

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
  -subj '/CN=sni-support-required-for-valid-ssl' \
  -keyout /etc/ssl/resty-auto-ssl-fallback.key \
  -out /etc/ssl/resty-auto-ssl-fallback.crt
```

### Step 6: Configure OpenResty

Clone the repository and copy configuration files:

```bash
cd /var/www
git clone https://github.com/theta42/proxy.git
cd proxy

# Copy nginx configs
mkdir -p /etc/openresty/sites-enabled/
cp ops/nginx_conf/nginx.conf /etc/openresty/nginx.conf
cp ops/nginx_conf/autossl.conf /etc/openresty/autossl.conf
cp ops/nginx_conf/proxy.conf /etc/openresty/sites-enabled/000-proxy
cp ops/nginx_conf/targetinfo.lua /usr/local/openresty/lualib/targetinfo.lua
```

### Step 7: Install Application

```bash
cd /var/www/proxy/nodejs
npm install
```

### Step 8: Configure Systemd Service

```bash
cp /var/www/proxy/ops/proxy.service /etc/systemd/system/proxy.service
systemctl daemon-reload
systemctl enable proxy.service
systemctl start proxy.service
```

Verify service is running:
```bash
systemctl status proxy.service
```

### Step 9: Initial Setup

The proxy API will be available on port 3000 by default. You'll need to:

1. Create your first user account
2. Configure DNS providers (for wildcard SSL)
3. Add your first host

See the [API Reference](api.html) for details.

## Configuration

### Environment Variables

- `NODE_ENV` - Set to `production` for production deployments
- `NODE_PORT` - Override default port (default: 3000)

### Redis Configuration

The proxy uses Redis with the prefix `proxy_`. To change this, edit `nodejs/conf/base.js`:

```javascript
redis: {
  prefix: 'proxy_'
}
```

### OpenResty Configuration

Key configuration files in `/etc/openresty/`:
- `nginx.conf` - Main nginx configuration
- `autossl.conf` - Let's Encrypt HTTP-01 challenge handler
- `sites-enabled/000-proxy` - Proxy server configuration

### Unix Socket

The proxy communicates with OpenResty via Unix socket at:
```
/var/run/proxy_lookup.socket
```

This path is configurable in `nodejs/conf/base.js`.

## Troubleshooting

### Service won't start

Check logs:
```bash
journalctl -u proxy.service -f
```

Common issues:
- Port 3000 already in use
- Redis not running: `systemctl status redis-server`
- Permission issues: Service must run as root for user management

### SSL certificates not working

Check OpenResty logs:
```bash
tail -f /var/log/nginx/error.log
```

Common issues:
- Firewall blocking ports 80/443
- DNS not pointing to server
- Let's Encrypt rate limits exceeded

### Host lookup not working

Check Unix socket:
```bash
ls -la /var/run/proxy_lookup.socket
# Should show srwxrwxrwx (socket permissions)
```

Test lookup:
```bash
echo '{"domain":"example.com"}' | nc -U /var/run/proxy_lookup.socket
```

## Next Steps

- [Configure DNS Providers](api.html#dns-providers) for wildcard SSL
- [Add your first host](api.html#hosts)
- [Set up the web interface](index.html)

[← Back to Home](index.html)
