# Deployment Guide — theta42/proxy

The proxy is an OpenID Connect-protected reverse proxy (OpenResty front + Node
management app + Redis) that is **both** an OIDC client of an SSO Manager *and*
a direct LDAP client for user lookups. Two deployment methods:

1. **Docker** — a single all-in-one image bundling OpenResty + the app + Redis
   (`docker compose up`).
2. **Bare metal** — `ops/install.sh` on Debian/Ubuntu (installs Node.js,
   OpenResty, Lua modules, Redis, and a systemd unit).

## How configuration works

The app loads configuration via [`@simpleworkjs/conf`](https://www.npmjs.com/package/@simpleworkjs/conf),
which deep-merges, in order:

1. `conf/base.js` (committed, generic defaults)
2. `conf/<NODE_ENV>.js` (optional)
3. `conf/secrets.js` (gitignored — secrets + per-deployment values)
4. **`app_*` environment variables** — the highest-precedence layer

Any env var whose name starts with `app_` overrides the merged config. The rest
of the name is split on **double-underscore** (`__`) into a nested path. Values
are `JSON.parse`-coerced when possible and kept as raw strings otherwise.

| Env var | Sets | Notes |
|---------|------|-------|
| `app_oidc__issuer` | `conf.oidc.issuer` | browser-facing SSO URL |
| `app_oidc__authorizationEndpoint` | `conf.oidc.authorizationEndpoint` | browser-facing |
| `app_oidc__tokenEndpoint` | `conf.oidc.tokenEndpoint` | server-to-server; can be internal |
| `app_oidc__userinfoEndpoint` | `conf.oidc.userinfoEndpoint` | server-to-server; can be internal |
| `app_oidc__endSessionEndpoint` | `conf.oidc.endSessionEndpoint` | browser-facing |
| `app_oidc__clientId` / `app_oidc__clientSecret` | OIDC client creds | register in the SSO first |
| `app_oidc__redirectUri` | `conf.oidc.redirectUri` | must match the SSO client exactly |
| `app_oidc__enabled` | `conf.oidc.enabled` | boolean |
| `app_ldap__url` | `conf.ldap.url` | `ldaps://…:636` or `ldap://…:389` |
| `app_ldap__bindDN` / `app_ldap__bindPassword` | LDAP service account | don't reuse the admin DN |
| `app_ldap__searchBase` / `app_ldap__userFilter` | user search | |
| `app_ldap__tlsOptions__rejectUnauthorized` | `conf.ldap.tlsOptions.rejectUnauthorized` | `false` for self-signed LDAPS |
| `app_ldap__tlsOptions__ca` | `conf.ldap.tlsOptions.ca` | path to a CA cert for strict trust |
| `app_auth__adminUsers` | `conf.auth.adminUsers` | local anti-lockout admin (uid) |
| `app_redis__prefix` | `conf.redis.prefix` | default `proxy_` |

> **Requires `@simpleworkjs/conf` >= 1.1.0.** The Docker image will not honor
> `app_*` env vars on 1.0.0. The lock is already on `^1.1.0`; if you regenerate it:
> ```bash
> cd nodejs && npm install @simpleworkjs/conf@^1.1.0
> ```

---

## Method 1: Docker (all-in-one)

The image (`Dockerfile`) bundles OpenResty + the app + Redis in one container,
mirroring the bare-metal `ops/install.sh` layout. `docker-entrypoint.sh`:
generates the fallback SSL cert, parameterizes the OpenResty `resolver`/
`set_real_ip_from` directives, starts Redis + the node app, and execs OpenResty
in the foreground under `dumb-init`.

### Setup

```bash
# Minimal: set the OIDC + LDAP wiring, then build + start.
OIDC_CLIENT_ID=... OIDC_CLIENT_SECRET=... LDAP_BIND_PASSWORD=... \
docker compose up -d --build
```

For a real deployment, put the overrides in a `.env` (or `environment:` in the
compose). See `docker-compose.yml` for the full set.

### Access

- Proxy (public): `https://<host>/` — OpenResty front, auto-SSL (Let's Encrypt)
- Management UI / API: `http://127.0.0.1:3000/` (bound to localhost; the front
  proxies the UI under its own TLS)
- Health: `http://127.0.0.1:3000/health` → `{"status":"ok"}`

### OpenResty runtime env

| Variable | Default | Description |
|----------|---------|-------------|
| `RESOLVER` | `127.0.0.11` | DNS for upstream names in Host records (Docker's embedded DNS) |
| `REAL_IP_FROM` | _empty_ | Trusted CIDR for `X-Real-IP`. Empty = proxy is the front (removes the real_ip block). Set to an upstream proxy's CIDR if one sits in front. |

### Auto-SSL / Let's Encrypt

`lua-resty-auto-ssl` stores certs in the bundled Redis (in-memory by default —
lost on container recreation). For cert persistence, enable Redis persistence
in `docker-entrypoint.sh` or mount a redis AOF/RDB volume. Port 80 is required
for HTTP-01 challenges (mapped in the compose).

---

## Method 2: Bare metal (Debian/Ubuntu)

`ops/install.sh` is an idempotent installer: it installs Node.js 22.x, OpenResty
(from openresty.org), Lua modules (luarocks), Redis, force-syncs the repo to
`/var/www/proxy`, symlinks the OpenResty + systemd config from the repo, and
starts `proxy.service`. Re-run it to update.

```bash
sudo ./ops/install.sh
```

Configuration is file-based: write `nodejs/conf/secrets.js` with the OIDC +
LDAP values (see `nodejs/conf/base.js` for the shape), then
`sudo systemctl restart proxy`.

---

## Fronting an SSO Manager

The proxy is a natural front for [`theta42/sso-manager-node`](https://github.com/theta42/sso-manager-node):
it terminates TLS for the SSO's UI and protects it with OIDC login, while also
binding to the SSO's LDAP directly for user lookups. To run both together:

1. **One Docker network** so the proxy can reach the SSO internally at
   `http://sso-manager:3001` (token/userinfo, server-to-server) and
   `ldaps://sso-manager:636` (LDAP).
2. **Set the SSO's `OAUTH_ISSUER`** to the browser-facing HTTPS URL the proxy
   serves the SSO at (e.g. `https://sso.example.com`).
3. **Register the proxy as an OIDC client** in the SSO, with a `redirectUri`
   matching the proxy's callback (`https://proxy.example.com/api/auth/oidc/callback`).
4. **LDAP**: point `app_ldap__url` at `ldaps://sso-manager:636` and create a
   dedicated service account (`cn=ldapclient,ou=people,…`) — don't reuse the
   admin DN. For the SSO's self-signed LDAPS cert, set
   `app_ldap__tlsOptions__rejectUnauthorized=false` (or mount the cert and use
   `app_ldap__tlsOptions__ca=<path>`).

The [`theta42/theta-env`](https://github.com/theta42/theta-env) unified repo
automates all four steps with `./setup.sh`.

---

## Security notes

1. **Never commit `secrets.js`** — it's in `.gitignore`.
2. **Bind the management port to localhost** (the compose does: `127.0.0.1:3000`).
   The OpenResty front proxies the UI under TLS; don't expose 3000 to the LAN.
3. **`REAL_IP_FROM` empty by default** — the proxy trusts no one to set `X-Real-IP`
   (it's the front). Only set it if a trusted proxy sits in front.
4. **LDAPS for any LDAP that crosses the network.** Use `ldaps://`/StartTLS; plain
   `ldap://` is fine only on a private docker network.
5. The image runs OpenResty workers as `nobody` and the node app as root (matches
   the bare-metal systemd unit). Harden to a non-root user for production if needed.