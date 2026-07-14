---
layout: default
title: API Reference
---

# API Documentation

[← Back to Home](index.html)

All API endpoints require authentication unless otherwise noted. Three
authentication methods are supported:

- **`auth-token` header** — a browser-session token from `POST /api/auth/login`
  or the OIDC flow (below).
- **`Authorization: Bearer <token>` header** — a self-service API token (PAT,
  see [API Tokens](#api-tokens)), for scripts/CI without a browser session.
- **OIDC (browser)** — if the proxy is configured as an OIDC client of an SSO
  (`app_oidc__*` / `conf.oidc`, see [DEPLOYMENT.md](https://github.com/theta42/proxy/blob/master/DEPLOYMENT.md)),
  users can log in via `GET /api/auth/oidc/start` instead of posting a
  username/password.

The proxy can also be configured as a **direct LDAP client** (`app_ldap__*` /
`conf.ldap`) for looking up/validating users, independent of the OIDC flow —
see DEPLOYMENT.md for the full configuration reference.

Authenticated requests also carry **RBAC** (role-based access control):
global admins can manage everything; other users are scoped to `viewer` or
`manager` rights on specific domains via [Permissions](#permissions) and
[Groups](#groups).

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

### OIDC Login (start)

**GET** `/api/auth/oidc/start`

Begin the OIDC authorization-code flow: creates a PKCE + state challenge and
redirects the browser to the configured SSO's authorize endpoint. Only
available when `conf.oidc.enabled` is true.

**Query Parameters:**
- `redirect` - Internal path to return to after login (optional; sanitized to same-origin)

```bash
curl -i "https://proxy-host.com/api/auth/oidc/start?redirect=/hosts"
```

**Responses:**
- `302` Redirect to the SSO's authorization endpoint
- `404` `{"name": "OidcDisabled", "message": "OIDC login is not enabled."}`

### OIDC Callback

**GET** `/api/auth/oidc/callback`

Redirect target for the SSO after login. Validates the one-time `state`,
exchanges the authorization `code` for tokens, reads identity from the
userinfo endpoint, establishes a session, and redirects the browser back to
the login page with the app's own `auth-token` in a URL fragment.

**Query Parameters:**
- `code` (required) - Authorization code from the SSO
- `state` (required) - State value from the `start` step

```bash
# Not called directly — the SSO redirects the browser here after login.
```

**Responses:**
- `302` Redirect to `/login#token=...&redirect=...`
- `400` `{"name": "OidcCallbackInvalid", "message": "Missing code or state."}` or expired/unknown state

---

## API Tokens

Self-service personal access tokens (PATs) for scripting/CI without a browser
session. Every endpoint is owner-scoped: a user only sees/manages tokens they
created. Mounted at `/api/api-token`.

### List API Tokens

**GET** `/api/api-token`

List the current user's API tokens.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/api-token
```

**Responses:**
- `200` `{"results": [{"id": "...", "name": "ci", ...}, ...]}`

### Create API Token

**POST** `/api/api-token`

Create a new API token. The raw token string is only returned once, at
creation.

**Parameters:**
- `name` (required) - Display name
- `description` (optional)
- `expires_in_days` (optional) - `0` or omitted means no expiry

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "ci", "expires_in_days": 90}' \
  https://proxy-host.com/api/api-token
```

**Responses:**
- `200` `{"results": {...}, "token": "prx_<id>_<secret>", "message": "API token 'ci' created. Save it now — it will not be shown again."}`

### Get API Token

**GET** `/api/api-token/:id`

Get a token's metadata (not the raw secret, which is never stored/returned again).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/api-token/<id>
```

**Responses:**
- `200` `{"results": {...}}`
- `403` Not your token

### Update API Token

**PUT** `/api/api-token/:id`

Update a token's name/description/expiry.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"name": "ci-updated"}' \
  https://proxy-host.com/api/api-token/<id>
```

**Responses:**
- `200` `{"results": {...}, "message": "API token 'ci-updated' updated."}`

### Delete (Revoke) API Token

**DELETE** `/api/api-token/:id`

Revoke a token immediately.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/api-token/<id>
```

**Responses:**
- `200` `{"id": "<id>", "message": "API token 'ci' revoked."}`

### Rotate API Token

**POST** `/api/api-token/:id/rotate`

Issue a new secret for an existing token (same id, new raw value shown once).

```bash
curl -H "auth-token: your-token-here" \
  -X POST \
  https://proxy-host.com/api/api-token/<id>/rotate
```

**Responses:**
- `200` `{"token": "prx_<id>_<new-secret>", "message": "API token 'ci' rotated. Save it — it will not be shown again."}`

---

## Users

All user endpoints require authentication. `GET /me` and `PUT /password`
(self-service) work for any authenticated user; everything else (listing,
creating, deleting users, resetting another user's password) requires global
admin.

### List Users

**GET** `/api/user`

Get list of all users. Admin only.

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/user
```

**Query Parameters:**
- `detail` - Include full user details (optional)

**Responses:**
- `200` `{"results": ["user1", "user2"]}`
- `200` `{"results": [{"username": "user1", ...}, ...]}` (with `?detail=true`)
- `403` Not an admin

### Get Current User

**GET** `/api/user/me`

Get the currently authenticated user's identity and effective RBAC rights
(drives the web UI's nav/button gating).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/user/me
```

**Responses:**
- `200` `{"username": "myuser", "groups": [...], "localGroups": [...], "externalGroups": [...], "isAdmin": false, "global": null, "domains": {...}}`

### Create User

**POST** `/api/user`

Create a new local user. Admin only.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"username": "newuser", "password": "newpassword"}' \
  https://proxy-host.com/api/user
```

**Responses:**
- `200` User created successfully
- `403` Not an admin
- `409` Username already exists
- `422` `{"name": "ObjectValidateError", "message": ...}` Validation error (also returned for weak passwords)

### Delete User

**DELETE** `/api/user/:username`

Delete a user account. Admin only.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/user/olduser
```

**Responses:**
- `200` `{"username": "olduser", "results": ...}`
- `403` Not an admin
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
- `422` Weak password rejected by the password policy

### Change Password (Other User)

**PUT** `/api/user/password/:username`

Change the password for another user. Admin only.

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X PUT \
  -d '{"password": "newpassword"}' \
  https://proxy-host.com/api/user/password/otheruser
```

**Responses:**
- `200` `{"results": ...}` Password changed successfully
- `403` Not an admin
- `404` User not found

---

## Permissions

RBAC: grants a `viewer` or `manager` role to a user or group, either globally
or scoped to one domain. Global-admin-only. Mounted at `/api/permission`.

### List Permissions

**GET** `/api/permission`

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/permission
```

**Responses:**
- `200` `{"results": [{"id": "...", "subjectType": "user", "subject": "alice", "role": "manager", "scope": "domain", "domain": "example.com", ...}, ...]}`

### List Permission Subjects

**GET** `/api/permission/subjects`

Autocomplete source for the "Subject" field: known usernames plus known group
names (local groups, groups already used in permissions, and groups from
`conf.auth.adminGroups` / `conf.auth.groupRoleMap`).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/permission/subjects
```

**Responses:**
- `200` `{"users": ["alice", "bob"], "groups": ["ops", "sre"]}`

### Create Permission

**POST** `/api/permission`

Grant a role to a subject.

**Parameters:**
- `subjectType` (required) - `user` or `group`
- `subject` (required) - username or group name
- `role` (required) - `viewer` or `manager`
- `scope` (required) - `global` or `domain`
- `domain` (required if `scope` is `domain`)

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"subjectType": "user", "subject": "alice", "role": "manager", "scope": "domain", "domain": "example.com"}' \
  https://proxy-host.com/api/permission
```

**Responses:**
- `200` `{"message": "Granted manager to user \"alice\" on example.com.", ...}`
- `422` Validation error

### Delete Permission

**DELETE** `/api/permission/:id`

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/permission/<id>
```

**Responses:**
- `200` `{"message": "Permission <id> removed."}`

---

## Groups

Local groups (independent of any SSO/LDAP groups) used as subjects for
permission grants. Global-admin-only. Mounted at `/api/group`.

### List Groups

**GET** `/api/group`

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/group
```

**Responses:**
- `200` `{"results": [{"name": "ops", "members": ["alice", "bob"], ...}, ...]}`

### Create Group

**POST** `/api/group`

**Parameters:**
- `name` (required)
- `members` (optional) - array of usernames

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "ops", "members": ["alice"]}' \
  https://proxy-host.com/api/group
```

**Responses:**
- `200` `{"message": "Group \"ops\" created.", ...}`

### Delete Group

**DELETE** `/api/group/:name`

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/group/ops
```

**Responses:**
- `200` `{"message": "Group \"ops\" removed."}`

### Add Group Member

**POST** `/api/group/:name/members`

**Parameters:**
- `username` (required)

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"username": "bob"}' \
  https://proxy-host.com/api/group/ops/members
```

**Responses:**
- `200` `{"message": "Added \"bob\" to \"ops\".", ...}`

### Remove Group Member

**DELETE** `/api/group/:name/members/:username`

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/group/ops/members/bob
```

**Responses:**
- `200` `{"message": "Removed \"bob\" from \"ops\".", ...}`

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

### Clear Host Cache

**DELETE** `/api/host/cache`

Remove all cached wildcard-subdomain host lookups. Cache entries are created on
demand when a wildcard host serves a subdomain; clearing them forces the next
request for each subdomain to be resolved fresh through the lookup tree.
Admin only.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/host/cache
```

**Responses:**
- `200` `{"message": "Cleared 3 cached hosts.", "count": 3}`

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
- `200` `{"results": [{"name": "Cloudflare", "fields": {...}}, {"name": "DigitalOcean", ...}, {"name": "PorkBun", ...}, {"name": "DuckDns", ...}]}`

### Create DNS Provider

**POST** `/api/dns`

Configure a new DNS provider.

**Cloudflare:**
```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "My Cloudflare", "dnsProvider": "Cloudflare", "token": "your-api-token"}' \
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

**DuckDNS (free):**
```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"name": "My DuckDNS", "dnsProvider": "DuckDns", "token": "your-duckdns-token", "domains": "myhost,myhost2"}' \
  https://proxy-host.com/api/dns
```

`domains` is a comma-separated list of the subdomains you've registered at
[duckdns.org](https://www.duckdns.org) (e.g. `myhost` for
`myhost.duckdns.org`), since DuckDNS has no API to list them for you.
DuckDNS only supports one A/AAAA record and one TXT record per domain (no
arbitrary sub-records) — enough for dynamic DNS and DNS-01 wildcard certs.

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

### Dynamic DNS

A-records kept automatically pointed at this box's public (WAN) IP. All
`/api/dns/dynamic*` routes are viewer/manager scoped to the record's domain
(via [Permissions](#permissions)), not admin-only like the rest of `/api/dns`.

#### Get Current Public IP

**GET** `/api/dns/dynamic/ip`

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns/dynamic/ip
```

**Responses:**
- `200` `{"ip": "203.0.113.5"}`

#### List Dynamic Records

**GET** `/api/dns/dynamic`

Lists records the caller may view (their own/granted domains, or all for admins).

```bash
curl -H "auth-token: your-token-here" \
  https://proxy-host.com/api/dns/dynamic
```

**Responses:**
- `200` `{"results": [{"id": "...", "domain": "example.com", "name": "home", "last_status": "ok", ...}, ...]}`

#### Create Dynamic Record

**POST** `/api/dns/dynamic`

Requires `manager` rights on the target domain. Applies the record immediately
against the current public IP (best-effort — failures are recorded in
`last_status` and retried by the scheduler).

**Parameters:**
- `domain` (required)
- `name` (required) - sub-label, or `@` for the apex

```bash
curl -H "Content-Type: application/json" \
  -H "auth-token: your-token-here" \
  -X POST \
  -d '{"domain": "example.com", "name": "home"}' \
  https://proxy-host.com/api/dns/dynamic
```

**Responses:**
- `200` `{"message": "\"home.example.com\" added.", ...}`
- `403` Missing `manager` rights on the domain
- `422` Validation error

#### Refresh Dynamic Record

**POST** `/api/dns/dynamic/:id/refresh`

Force an immediate refresh of one record against the current public IP.
Requires `manager` rights on the record's domain.

```bash
curl -H "auth-token: your-token-here" \
  -X POST \
  https://proxy-host.com/api/dns/dynamic/<id>/refresh
```

**Responses:**
- `200` `{"message": "Refreshed \"home.example.com\".", "result": {...}}`
- `403` Missing `manager` rights on the domain

#### Delete Dynamic Record

**DELETE** `/api/dns/dynamic/:id`

Stop managing a record. Requires `manager` rights on the record's domain.
Leaves the provider's A record in place at its last value.

```bash
curl -H "auth-token: your-token-here" \
  -X DELETE \
  https://proxy-host.com/api/dns/dynamic/<id>
```

**Responses:**
- `200` `{"message": "home.example.com removed.", ...}`
- `403` Missing `manager` rights on the domain

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
- Authenticated endpoints accept either the `auth-token` header (browser
  session / OIDC login) or an `Authorization: Bearer <token>` API token
- Host names support wildcards: `*` (single level) and `**` (multi-level)
- DNS providers are validated on creation - invalid API credentials will be rejected
- Wildcard certificates are automatically renewed 30 days before expiration
