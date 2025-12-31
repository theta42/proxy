---
layout: default
title: Architecture
---

# Architecture

[← Back to Home](index.html)

## System Overview

The proxy system consists of three main components working together to provide high-performance reverse proxying with automated SSL management.

```
┌──────────────────────────────────────────────────────────────┐
│                         Internet                              │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTPS/HTTP
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    OpenResty/Nginx                            │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ SSL Termination│  │ Host Routing │  │ Request Proxying│  │
│  │ (lua-resty-    │  │ (targetinfo. │  │                 │  │
│  │  auto-ssl)     │  │  lua)        │  │                 │  │
│  └────────────────┘  └──────────────┘  └─────────────────┘  │
└────────────┬──────────────────┬───────────────────────────┬──┘
             │                  │                           │
     Let's Encrypt       Unix Socket                   Backend
       HTTP-01          Lookup Query                  Services
             │                  │                           │
             ▼                  ▼                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Node.js Application                        │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │   Services   │  │    Models      │  │     Routes      │  │
│  │ - host_lookup│  │ - Host         │  │ - /api/host     │  │
│  │ - scheduler  │  │ - DNS Provider │  │ - /api/dns      │  │
│  └──────────────┘  │ - User         │  │ - /api/user     │  │
│                    │ - Auth         │  │ - /api/auth     │  │
│                    └────────────────┘  │ - /api/cert     │  │
│                                        └─────────────────┘  │
└────────────┬────────────────────┬────────────────────────────┘
             │                    │
             ▼                    ▼
┌──────────────────────┐  ┌──────────────────────┐
│       Redis          │  │    DNS Providers     │
│  - Host configs      │  │  - CloudFlare        │
│  - User accounts     │  │  - DigitalOcean      │
│  - SSL certs         │  │  - PorkBun           │
│  - Auth tokens       │  │  (DNS-01 challenges) │
└──────────────────────┘  └──────────────────────┘
```

## Component Details

### OpenResty/Nginx (Frontend)

**Responsibilities:**
- Accept incoming HTTP/HTTPS requests
- SSL termination using lua-resty-auto-ssl
- Host-based routing decisions
- Proxy requests to backend services

**Key Features:**
- HTTP-01 ACME challenge handling for automatic SSL
- Lua-based host lookup via Unix socket
- High-performance event-driven architecture
- Support for WebSocket connections

**Configuration Files:**
- `/etc/openresty/nginx.conf` - Main configuration
- `/etc/openresty/autossl.conf` - Let's Encrypt integration
- `/etc/openresty/sites-enabled/000-proxy` - Proxy configuration
- `/usr/local/openresty/lualib/targetinfo.lua` - Host lookup module

### Node.js Application (Backend)

**Responsibilities:**
- API for host/user/DNS management
- Wildcard SSL certificate orchestration
- Host lookup tree maintenance
- User authentication and authorization

**Directory Structure:**
```
nodejs/
├── bin/www              # Application entry point
├── models/              # Data models
│   ├── host.js          # Host configuration and lookup
│   ├── auth.js          # Authentication logic
│   ├── user.js          # User management
│   └── dns_provider/    # DNS provider implementations
├── routes/              # API endpoints
│   ├── host.js          # Host CRUD operations
│   ├── dns.js           # DNS provider management
│   ├── user.js          # User management
│   └── auth.js          # Authentication
├── services/            # Background services
│   ├── host_lookup.js   # Unix socket server
│   └── host_scheduler.js # Cert renewal scheduler
├── middleware/          # Express middleware
│   └── auth.js          # Authentication middleware
└── utils/               # Utility modules
    └── unix_socket_json.js # Unix socket server
```

### Redis (Data Store)

**Stored Data:**
- Host configurations (domain, IP, port, SSL settings)
- User accounts and hashed passwords
- Authentication tokens
- SSL certificates (for wildcard domains)
- DNS provider credentials
- Domain-to-provider mappings

**Key Prefixes:**
```
proxy_Host_<hostname>           # Host configuration
proxy_User_<username>           # User account
proxy_AuthToken_<token>         # Auth tokens
proxy_DnsProvider_<id>          # DNS provider
proxy_Domain_<domain>           # Domain info
<hostname>:latest               # SSL certificate cache
```

## Request Flow

### Standard HTTP/HTTPS Request

1. **Client** sends HTTPS request to `app.example.com`
2. **OpenResty** receives request, terminates SSL
3. **Lua script** (`targetinfo.lua`) queries Redis for host config
4. If **cache miss**, Lua queries Node.js via Unix socket
5. **Node.js** performs host lookup (supports wildcards)
6. **Response** returned with target IP and port
7. **OpenResty** proxies request to backend service
8. **Response** proxied back to client

### Wildcard SSL Certificate Request

1. **User** creates wildcard host (`*.example.com`) via API
2. **Node.js** validates domain has DNS provider configured
3. **Let's Encrypt** DNS-01 challenge initiated
4. **DNS provider** API creates TXT record (`_acme-challenge.example.com`)
5. **Let's Encrypt** validates TXT record
6. **Certificate** generated and stored in Redis
7. **DNS provider** cleans up TXT record
8. **Background scheduler** monitors expiration, renews 30 days before expiry

## Host Lookup Algorithm

The lookup tree enables sophisticated domain matching:

```
Input: "api.v1.example.com"

Tree Structure:
{
  "com": {
    "example": {
      "*": {          // Matches api.example.com
        "#record": {...}
      },
      "v1": {
        "api": {      // Matches api.v1.example.com (exact)
          "#record": {...}
        }
      }
    }
  }
}

Priority: Exact > Single wildcard (*) > Double wildcard (**)
```

**Wildcard Types:**
- `example.com` - Exact match only
- `*.example.com` - Matches `sub.example.com` (single level)
- `**.example.com` - Matches any depth (`sub.deep.example.com`)
- `api.*.example.com` - Matches `api.v1.example.com`, `api.v2.example.com`

## Security Architecture

### Authentication Flow

1. User sends credentials to `/api/auth/login`
2. Credentials validated against stored hash (bcrypt)
3. Token generated and stored in Redis with TTL
4. Token returned to client
5. Subsequent requests include token in `auth-token` header
6. Middleware validates token before processing request

### SSL Certificate Security

- **Private keys** stored only in Redis (memory/disk based on config)
- **Fallback certificates** used when SNI unavailable
- **Let's Encrypt** rate limiting respected
- **DNS provider credentials** marked as `isPrivate` (not returned in API)

### Unix Socket Communication

- Socket file: `/var/run/proxy_lookup.socket`
- Permissions: `777` (container-safe, single-use deployment)
- Protocol: JSON over Unix stream socket
- Buffer handling: Accumulates partial messages until complete JSON

## Performance Optimizations

### Caching Strategy

1. **Redis cache** - Primary host configuration storage
2. **Lookup tree** - In-memory host lookup (rebuilt on changes)
3. **OpenResty cache** - Reduces Unix socket calls
4. **Wildcard parent caching** - Stores resolved wildcard parents

### Unix Socket vs HTTP API

Unix socket chosen over HTTP for host lookups:
- **Lower latency** - No TCP overhead
- **Higher throughput** - No HTTP parsing
- **Simpler** - Direct JSON communication
- **Secure** - Filesystem permissions, no network exposure

## Scalability Considerations

### Current Architecture

- **Single instance** - OpenResty + Node.js + Redis on one server
- **Vertical scaling** - Add CPU/RAM as needed
- **Limitations** - Unix socket ties OpenResty to Node.js on same host

### Future Scaling Options

- **Redis cluster** - Distribute data storage
- **Multiple OpenResty instances** - Load balance incoming requests
- **Stateless Node.js** - Run multiple API instances
- **Replace Unix socket** - Use TCP/HTTP for cross-host communication
- **Separate cert management** - Dedicated service for wildcard SSL

## Monitoring and Observability

### Logs

- **OpenResty**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Node.js**: `journalctl -u proxy.service`
- **Redis**: `redis-cli MONITOR`

### Health Checks

- Node.js API: `curl http://localhost:3000/api/host`
- Redis: `redis-cli PING`
- OpenResty: `systemctl status openresty`
- Unix socket: `ls -la /var/run/proxy_lookup.socket`

### Metrics to Monitor

- Request rate and response times
- SSL certificate expiration dates
- Redis memory usage
- Host lookup cache hit rate
- Background service execution times

[← Back to Home](index.html)
