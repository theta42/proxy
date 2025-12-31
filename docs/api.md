---
layout: default
title: API Reference
---

# API Documentation

[← Back to Home](index.html)

All API endpoints require authentication via the `auth-token` header unless otherwise noted.

Base URL: `https://your-proxy-host.com/api`

---

## Authentication

### Login

**POST** `/api/auth/login`

Authenticate a user and receive an auth token.

```bash
curl -H "Content-Type: application/json" \
  -X POST \
  -d '{"username": "myuser", "password": "mypassword"}' \
  https://proxy-host.com/api/auth/login
```

**Responses:**
- `200` `{"login": true, "token": "027d3964-7d81-4462-a6f9-2c1f9b40b4be", "message": "myuser logged in!"}`
- `401` `{"name": "LoginFailed", "message": "Invalid Credentials, login failed."}`

### Logout

**ALL** `/api/auth/logout`

Invalidate the current auth token.

```bash
curl -H "auth-token: your-token-here" \
  -X POST \
  https://proxy-host.com/api/auth/logout
```

**Responses:**
- `200` `{"message": "Bye"}`

---

## Users

All user endpoints require authentication.

### List Users

**GET** `/api/user`

Get list of all users.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/user
```

**Query Parameters:**
- `detail` - Include full user details (optional)

**Responses:**
- `200` `{"results": ["user1", "user2"]}`
- `200` `{"results": [{"username": "user1", ...}, ...]}` (with `?detail=true`)

### Get Current User

**GET** `/api/user/me`

Get information about the currently authenticated user.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/user/me
```

**Responses:**
- `200` `{"username": "myuser"}`

### Create User

**POST** `/api/user`

Create a new user.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"username": "newuser", "password": "newpassword"}' \
  https://proxy-host.com/api/user
```

**Responses:**
- `200` User created successfully
- `409` Username already exists
- `422` `{"name": "ObjectValidateError", "message": ...}` Validation error

### Delete User

**DELETE** `/api/user/:username`

Delete a user account.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/user/olduser
```

**Responses:**
- `200` `{"username": "olduser", "results": ...}`
- `404` User not found

### Change Password (Self)

**PUT** `/api/user/password`

Change the password for the currently authenticated user.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"password": "newpassword"}' \
  https://proxy-host.com/api/user/password
```

**Responses:**
- `200` `{"results": ...}` Password changed successfully

### Change Password (Other User)

**PUT** `/api/user/password/:username`

Change the password for another user (admin function).

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"password": "newpassword"}' \
  https://proxy-host.com/api/user/password/otheruser
```

**Responses:**
- `200` `{"results": ...}` Password changed successfully
- `404` User not found

### Create Invite Token

**POST** `/api/user/invite`

Create an invitation token for new user registration.

```bash
curl -H "auth-token: your-token-here" \
  -X POST \
  https://proxy-host.com/api/user/invite
```

**Responses:**
- `200` `{"token": "5caf94d2-2c91-4010-8df7-968d10802b9d"}`

### Add SSH Key

**POST** `/api/user/key`

Add an SSH public key to the current user's account.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"key": "ssh-rsa AAAAB3..."}' \
  https://proxy-host.com/api/user/key
```

**Responses:**
- `200` `{"message": true}` Key added successfully
- `400` `{"message": "Bad SSH key"}` Invalid key format

---

## Hosts

Manage proxy host configurations.

### List Hosts

**GET** `/api/host`

Get list of all configured hosts.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/host
```

**Query Parameters:**
- `detail` - Include full host details (optional)

**Responses:**
- `200` `{"results": ["example.com", "*.wildcard.com"]}`
- `200` `{"results": [{"host": "example.com", "ip": "192.168.1.10", ...}, ...]}` (with `?detail=true`)

### Get Host

**GET** `/api/host/:host`

Get configuration for a specific host.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/host/example.com
```

**Responses:**
- `200` `{"item": "example.com", "results": {"host": "example.com", "ip": "192.168.1.10", "targetPort": 8080, ...}}`
- `404` `{"name": "HostNotFound", "message": "Host does not exists"}`

### Lookup Host

**GET** `/api/host/lookup/:domain`

Test the host lookup algorithm (supports wildcard matching).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/host/lookup/sub.example.com
```

**Responses:**
- `200` `{"string": "sub.example.com", "results": {"host": "*.example.com", ...}}`
- `200` `{"string": "sub.example.com", "results": null}` (no match)

### Get Lookup Tree

**GET** `/api/host/lookupobj`

Get the internal lookup tree structure (for debugging).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/host/lookupobj
```

**Responses:**
- `200` `{"results": {"com": {"example": {...}}}}`

### Create Host

**POST** `/api/host`

Add a new host configuration.

**Parameters:**
- `host` (required) - Domain name (e.g., `example.com`, `*.example.com`)
- `ip` (required) - Target IP address or FQDN
- `targetPort` (required) - Target port number (1-65535)
- `forcessl` (optional) - Force HTTPS redirect (default: true)
- `targetssl` (optional) - Use HTTPS to backend (default: false)
- `challengeType` (optional) - For wildcards: `DNS-01-wildcard` or `wildcardChild`

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"host": "example.com", "ip": "192.168.1.10", "targetPort": 8080, "forcessl": true, "targetssl": false}' \
  https://proxy-host.com/api/host
```

**Responses:**
- `200` `{"message": "\"example.com\" added.", "host": "example.com", ...}`
- `409` `{"name": "HostNameUsed", "message": "Host already exists"}`
- `422` `{"name": "ObjectValidateError", "message": ...}` Validation error

### Update Host

**PUT** `/api/host/:host`

Update an existing host configuration.

**Parameters:** Same as Create Host (all optional)

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"ip": "192.168.1.20", "targetPort": 9000}' \
  https://proxy-host.com/api/host/example.com
```

**Responses:**
- `200` `{"message": "\"example.com\" updated.", ...}`
- `404` `{"name": "HostNotFound", "message": "Host does not exists"}`
- `422` Validation error

### Delete Host

**DELETE** `/api/host/:host`

Remove a host configuration.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/host/example.com
```

**Responses:**
- `200` `{"message": "example.com deleted", ...}`
- `404` `{"name": "HostNotFound", "message": "Host does not exists"}`

### Renew Wildcard Certificate

**PUT** `/api/host/:host/renew`

Manually trigger wildcard certificate renewal.

```bash
curl -H "auth-token: your-token-here" \
  -X PUT \
  https://proxy-host.com/api/host/*.example.com/renew
```

**Responses:**
- `200` `{"message": "Requesting wildcard cert for *.example.com"}`
- `404` Host not found

---

## DNS Providers

Manage DNS provider integrations for wildcard SSL certificates.

### List DNS Providers

**GET** `/api/dns`

Get list of configured DNS providers.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns
```

**Query Parameters:**
- `detail` - Include full provider details (optional)

**Responses:**
- `200` `{"results": ["provider-id-1", "provider-id-2"]}`

### List Available Provider Types

**OPTIONS** `/api/dns`

Get list of supported DNS provider types and their configuration requirements.

```bash
curl -H "auth-token: your-token-here" \
  -X OPTIONS \
  https://proxy-host.com/api/dns
```

**Responses:**
- `200` `{"results": [{"name": "CloudFlare", "fields": {...}}, {"name": "DigitalOcean", ...}, ...]}`

### Create DNS Provider

**POST** `/api/dns`

Configure a new DNS provider.

**CloudFlare:**
```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "My CloudFlare", "dnsProvider": "Cloudflare", "token": "your-api-token"}' \
  https://proxy-host.com/api/dns
```

**DigitalOcean:**
```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "My DO", "dnsProvider": "DigitalOcean", "token": "your-api-token"}' \
  https://proxy-host.com/api/dns
```

**PorkBun:**
```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "My PorkBun", "dnsProvider": "PorkBun", "apiKey": "pk_xxx", "secretApiKey": "sk_xxx"}' \
  https://proxy-host.com/api/dns
```

**Responses:**
- `200` `{"message": "\"provider-id\" added.", ...}`
- `422` Validation error or invalid API credentials

### Get DNS Provider

**GET** `/api/dns/:id`

Get a specific DNS provider configuration.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns/provider-id
```

**Responses:**
- `200` `{"item": "provider-id", "results": {...}}`
- `404` Provider not found

### Update DNS Provider

**PUT** `/api/dns/:id`

Update DNS provider configuration.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"name": "Updated Name"}' \
  https://proxy-host.com/api/dns/provider-id
```

**Responses:**
- `200` `{"message": "\"provider-id\" updated.", ...}`
- `404` Provider not found

### Delete DNS Provider

**DELETE** `/api/dns/:id`

Remove a DNS provider and all associated domains.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/dns/provider-id
```

**Responses:**
- `200` `{"message": "provider-id deleted", ...}`
- `404` Provider not found

### List Domains

**GET** `/api/dns/domain`

List all domains from all configured providers.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns/domain
```

**Query Parameters:**
- `detail` - Include full domain details (optional)

**Responses:**
- `200` `{"results": ["example.com", "test.com"]}`

### Get Domain

**GET** `/api/dns/domain/:domain`

Get details for a specific domain.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns/domain/example.com
```

**Responses:**
- `200` `{"results": [{"domain": "example.com", "zoneId": "...", ...}]}`
- `404` Domain not found

### Refresh Domains

**POST** `/api/dns/domain/refresh/:providerId`

Refresh the domain list from a DNS provider's API.

```bash
curl -H "auth-token: your-token-here" \
  -X POST \
  https://proxy-host.com/api/dns/domain/refresh/provider-id
```

**Responses:**
- `200` `{"results": ...}` Updated domain list
- `404` Provider not found

---

## Certificates

Retrieve SSL certificate information.

### Get Certificate

**GET** `/api/cert/:host`

Get the SSL certificate for a host.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/cert/example.com
```

**Responses:**
- `200` Certificate data including `cert_pem`, `fullchain_pem`, `privkey_pem`, expiry information
- `404` Certificate not found

---

## Error Responses

All endpoints may return the following error responses:

- `401` `{"name": "LoginFailed", "message": "Invalid Credentials, login failed."}` - Authentication required or invalid
- `404` `{"name": "NotFound", "message": "..."}` - Resource not found
- `422` `{"name": "ObjectValidateError", "message": [...], "keys": [...]}` - Validation errors
- `500` Internal server error

## Notes

- All timestamps are in milliseconds since epoch
- The `auth-token` header is required for all authenticated endpoints
- Host names support wildcards: `*` (single level) and `**` (multi-level)
- DNS providers are validated on creation - invalid API credentials will be rejected
- Wildcard certificates are automatically renewed 30 days before expiration
