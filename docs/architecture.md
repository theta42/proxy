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
│  └────────────────┘  └──────┬───────┘  └─────────────────┘  │
└────────────┬──────────────────┼───────────────────────────┬──┘
             │                  │                           │
     Let's Encrypt       1. Check Redis FIRST          Backend
       HTTP-01           2. Unix Socket (fallback)    Services
             │                  │                           │
             ▼                  ▼                           ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│       Redis          │  │      Node.js Application         │
│  (Primary Cache)     │  │  ┌──────────────┐  ┌─────────┐  │
│  - Host configs ◄────┼──┼──┤   Services   │  │ Routes  │  │
│  - User accounts     │  │  │ - host_lookup│  │ - /api/*│  │
│  - SSL certs         │  │  │ - scheduler  │  │         │  │
│  - Auth tokens       │  │  └──────────────┘  └─────────┘  │
└──────────────────────┘  └─────────┬────────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │    DNS Providers     │
                          │  - CloudFlare        │
                          │  - DigitalOcean      │
                          │  - PorkBun           │
                          │  (DNS-01 challenges) │
                          └──────────────────────┘
```

## Component Details

### OpenResty/Nginx (Frontend)

**Responsibilities:**
- Accept incoming HTTP/HTTPS requests
- SSL termination using lua-resty-auto-ssl
- Host-based routing decisions (Redis-first lookup)
- Proxy requests to backend services

**Key Features:**
- HTTP-01 ACME challenge handling for automatic SSL
- Redis-first host lookup with Node.js fallback via Unix socket
- High-performance event-driven architecture
- Support for WebSocket connections
- Continues serving cached hosts even if Node.js is down

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

**ORM:** [model-redis](https://www.npmjs.com/package/model-redis) - A lightweight Redis ORM for Node.js with schema validation, relationships, and automatic key management.

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
3. **Lua script** (`targetinfo.lua`) queries **Redis first** for host config
4. If **found in Redis**, jump to step 7 (Node.js not involved)
5. If **not in Redis**, Lua queries Node.js via Unix socket as fallback
6. **Node.js** performs host lookup (supports wildcards), caches result in Redis
7. **OpenResty** proxies request to backend service using target IP and port
8. **Response** proxied back to client

**Resilience**: If Node.js goes down, all hosts already cached in Redis continue to work. Only new/uncached hosts will fail until Node.js recovers.

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

The system uses a multi-tier caching approach:

1. **Redis (L1 Cache)** - OpenResty checks Redis FIRST for every request
   - Primary host configuration storage
   - Survives Node.js restarts/failures
   - Shared across all OpenResty workers

2. **Node.js Lookup Tree (L2 Cache)** - In-memory host lookup with wildcard matching
   - Only queried when Redis has no entry
   - Rebuilt automatically when hosts change
   - Supports complex wildcard resolution

3. **Wildcard Parent Caching** - Resolved wildcard matches stored back to Redis
   - Subsequent requests to `api.example.com` hit Redis directly
   - No repeated wildcard resolution needed

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
