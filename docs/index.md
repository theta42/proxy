---
layout: default
title: Home
---

# Proxy

A reverse proxy and HTTPS termination service using OpenResty/nginx with a management API and web GUI.

## Features

- **Automated HTTPS/SSL** - Let's Encrypt integration with HTTP-01 and DNS-01 challenges
- **Wildcard SSL Certificates** - Support for wildcard domains with automatic renewal
- **Multiple DNS Providers** - CloudFlare, DigitalOcean, PorkBun integrations
- **Advanced Routing** - Sophisticated wildcard domain matching (*, **)
- **RESTful API** - Full programmatic control
- **Web Interface** - User-friendly management GUI
- **High Performance** - Unix socket-based host lookup for minimal latency

## Quick Start

### Automated Installation

For modern Debian-based systems (Ubuntu 20.04+, Debian 11+):

```bash
wget -O - https://raw.githubusercontent.com/theta42/proxy/master/ops/install.sh | sudo bash
```

### Requirements

- Node.js 18+ (tested with 18.x, 20.x, 22.x)
- OpenResty (nginx with Lua support)
- Redis
- Linux system with root access

## Documentation

- [Installation Guide](installation.html) - Detailed setup instructions
- [API Reference](api.html) - Complete API documentation
- [Architecture](architecture.html) - System design and components
- [Contributing](contributing.html) - Development and testing guide

## Use Cases

**Development Teams**
- Host multiple projects on a single server with unique domains
- Automatic SSL for all development sites
- Easy configuration via API or web UI

**Production Deployments**
- High-performance reverse proxy for microservices
- Centralized SSL certificate management
- Dynamic routing without nginx reloads

**Personal Projects**
- Self-hosted services with automatic HTTPS
- Wildcard certificates for unlimited subdomains
- Simple management interface

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────┐
│  OpenResty/Nginx    │
│  - SSL Termination  │
│  - Host Routing     │
└──────┬──────────────┘
       │ Unix Socket
       ▼
┌─────────────────────┐      ┌─────────────┐
│   Node.js API       │◄────►│    Redis    │
│  - Management       │      │  - Storage  │
│  - SSL Orchestration│      │  - Cache    │
└──────┬──────────────┘      └─────────────┘
       │
       ▼
┌─────────────────────┐
│  Backend Services   │
│  - Your Apps        │
└─────────────────────┘
```

## Community

- [GitHub Repository](https://github.com/theta42/proxy)
- [Issue Tracker](https://github.com/theta42/proxy/issues)
- [Pull Requests](https://github.com/theta42/proxy/pulls)

## License

MIT License - See [LICENSE](https://github.com/theta42/proxy/blob/master/LICENSE) for details.
