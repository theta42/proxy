---
layout: default
title: Docker
description: Running the proxy's all-in-one Docker image — OpenResty, the management app, and Redis in one container.
---

# Docker Deployment

[← Back to Home](index.html)

The proxy ships as a single all-in-one Docker image bundling **OpenResty + the
Node management app + Redis** in one container, mirroring the bare-metal
[`ops/install.sh`](https://github.com/theta42/proxy/blob/master/ops/install.sh)
layout. This is the easiest way to run the proxy standalone, or as part of the
unified [theta-env](https://github.com/theta42/theta-env) stack.

## Quick start (standalone)

```bash
git clone https://github.com/theta42/proxy.git
cd proxy
mkdir -p config && chmod 700 config
cp secrets.js.example config/proxy-secrets.js   # set OIDC/LDAP wiring
$EDITOR config/proxy-secrets.js
docker compose up -d --build
```

- Proxy (public, auto-SSL): `https://<host>/`
- Management UI / API: `http://127.0.0.1:3000/` (bound to localhost)
- Health: `http://127.0.0.1:3000/health` → `{"status":"ok"}`

## How configuration works

The app loads config via [`@simpleworkjs/conf`](https://www.npmjs.com/package/@simpleworkjs/conf),
which deep-merges, in order:

1. `conf/base.js` (committed defaults)
2. `conf/<NODE_ENV>.js` (optional)
3. `conf/secrets.js` (gitignored)
4. **`app_*` environment variables** — the highest-precedence layer

The bundled `docker-compose.yml` mount `./config/proxy-secrets.js` at `/config`,
and `docker-entrypoint.sh` symlinks it into `/app/conf/secrets.js` so the app
reads the OIDC + LDAP + auth wiring from the file. **No `app_*` env is passed** —
`app_*` env beats `secrets.js`, so the file is authoritative only if the matching
`app_*` env is absent. See `secrets.js.example` for the shape.

Any env var starting with `app_` overrides the merged config; the rest of the
name splits on **double-underscore** (`__`) into a nested path. Values are
`JSON.parse`-coerced when possible, kept as strings otherwise. `app_*` env is
still supported for advanced/standalone use — add the vars to the compose
`environment:` block yourself (the bundled compose no longer sets them).

> **Requires `@simpleworkjs/conf` >= 1.1.0.** The `app_*` env layer is not
> honored on 1.0.0. The lock is already on `^1.1.0`.

### Key `app_*` variables

| Env var | Sets |
|---------|------|
| `app_oidc__issuer` | `conf.oidc.issuer` (browser-facing SSO URL) |
| `app_oidc__authorizationEndpoint` | `conf.oidc.authorizationEndpoint` |
| `app_oidc__tokenEndpoint` | `conf.oidc.tokenEndpoint` (server-to-server; can be internal) |
| `app_oidc__userinfoEndpoint` | `conf.oidc.userinfoEndpoint` (server-to-server) |
| `app_oidc__endSessionEndpoint` | `conf.oidc.endSessionEndpoint` |
| `app_oidc__clientId` / `app_oidc__clientSecret` | OIDC client creds |
| `app_oidc__redirectUri` | `conf.oidc.redirectUri` (must match the SSO client) |
| `app_oidc__enabled` | `conf.oidc.enabled` (boolean) |
| `app_ldap__url` | `conf.ldap.url` (`ldaps://…:636` or `ldap://…:389`) |
| `app_ldap__bindDN` / `app_ldap__bindPassword` | LDAP service account |
| `app_ldap__searchBase` / `app_ldap__userFilter` | user search |
| `app_ldap__tlsOptions__rejectUnauthorized` | `false` for self-signed LDAPS |
| `app_ldap__tlsOptions__ca` | path to a CA cert for strict trust |
| `app_auth__adminUsers` | local anti-lockout admin (uid) |
| `app_auth__adminGroups` | SSO/LDAP groups that are global admin (JSON array) |
| `app_redis__prefix` | `conf.redis.prefix` (default `proxy_`) |

See [`DEPLOYMENT.md`](https://github.com/theta42/proxy/blob/master/DEPLOYMENT.md)
for the complete reference.

## OpenResty runtime env

| Variable | Default | Description |
|----------|---------|-------------|
| `RESOLVER` | `127.0.0.11` | DNS for upstream names in Host records (Docker's embedded DNS) |
| `REAL_IP_FROM` | _empty_ | Trusted CIDR for `X-Real-IP`. Empty = the proxy is the front (removes the real_ip block). Set to an upstream proxy's CIDR if one sits in front. |

## Auto-SSL / Let's Encrypt

`lua-resty-auto-ssl` stores certs in the bundled Redis. Redis is now AOF+RDB
persisted to the `proxy-data` volume (not in-memory), so **Let's Encrypt certs
survive container recreation** — no re-issue / rate-limit on rebuild. Port 80 is
required for HTTP-01 challenges (mapped in the compose). Back up + restore Redis
to back up + restore cert state (see *Backups and restore* in `DEPLOYMENT.md`).

## Fronting an SSO Manager

The proxy is a natural front for
[`theta42/sso-manager-node`](https://github.com/theta42/sso-manager-node): it
terminates TLS for the SSO's UI and protects it with OIDC login, while also
binding to the SSO's LDAP directly for user lookups. To run both together:

1. **One Docker network** so the proxy reaches the SSO internally at
   `http://sso-manager:3001` (token/userinfo) and `ldaps://sso-manager:636`.
2. **Set the SSO's `app_oauth__issuer`** to the browser-facing HTTPS URL the
   proxy serves the SSO at (e.g. `https://sso.example.com`).
3. **Register the proxy as an OIDC client** in the SSO, with `redirectUri`
   matching `https://proxy.example.com/api/auth/oidc/callback`.
4. **LDAP**: point `app_ldap__url` at `ldaps://sso-manager:636`, create a
   dedicated service account (`cn=ldapclient,ou=people,…`), and for the SSO's
   self-signed LDAPS cert set `app_ldap__tlsOptions__rejectUnauthorized=false`
   (or mount the cert and use `app_ldap__tlsOptions__ca=<path>`).

The [`theta42/theta-env`](https://github.com/theta42/theta-env) unified repo
automates all four steps with `./setup.sh` — see
[theta-env docs](https://theta42.github.io/theta-env/).

## API tokens (personal access tokens)

Any logged-in user can mint a long-lived bearer token to call the management API
from scripts/CI without an OIDC browser session. Self-service; authenticates as
the creator (groups snapshotted at mint; authz layer unchanged).

Create one under **API Tokens** in the UI (shown once), then:

```bash
curl -H "Authorization: Bearer prx_<id>_<secret>" https://proxy.example.com/api/host
```

Rotate/revoke from the same page (immediate effect). Optional expiry at
creation. The token carries the creator's rights (admin → full mgmt API;
domain manager → those domains; `requireAdmin` routes 403). To tighten after
group changes, revoke + re-mint. Tokens persist in Redis (AOF) and survive
rebuilds.

## Bare metal

Prefer a systemd install? See the [Installation Guide](installation.html) for
the `ops/install.sh` automated installer on Debian/Ubuntu.

[← Back to Home](index.html)