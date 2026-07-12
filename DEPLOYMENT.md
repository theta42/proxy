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

The bundled `docker-compose.yml` reads the OIDC + LDAP + auth wiring from a
bind-mounted `./config/proxy-secrets.js` (not from `app_*` env). Copy the
example, fill in your secrets, then build + start:

```bash
mkdir -p config && chmod 700 config
cp secrets.js.example config/proxy-secrets.js
$EDITOR config/proxy-secrets.js     # set oidc.clientId/clientSecret, ldap.bindPassword, ...
docker compose up -d --build
```

`docker-entrypoint.sh` symlinks `/config/proxy-secrets.js` → `/app/conf/secrets.js`
so `@simpleworkjs/conf` reads it. No `app_*` env is passed — `app_*` env would
override the file (env beats secrets.js in `@simpleworkjs/conf`), so the file is
kept authoritative. `RESOLVER` / `REAL_IP_FROM` / `NODE_ENV` / `NODE_PORT` are
OpenResty-runtime / process env, not `app_*` config, so they stay in the compose.

> Running the unified `theta-env` stack? Its `setup.sh` generates
> `./config/proxy-secrets.js` (+ `./config/sso-secrets.js`) for you and
> registers the OAuth client with the SSO — see the theta-env README.

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

`lua-resty-auto-ssl` stores certs in the bundled Redis. Redis is now AOF+RDB
persisted to the `proxy-data` volume (not in-memory), so **Let's Encrypt certs
survive container recreation** — no re-issue / rate-limit on rebuild. Port 80 is
required for HTTP-01 challenges (mapped in the compose).

### Backups and restore

**What lives where**

| State | Location | Persisted? |
|-------|----------|------------|
| Host records, permissions, DNS creds, local users | `proxy-data` volume (`/data`, Redis) | yes (AOF + RDB) |
| Let's Encrypt certs (auto-ssl) | `proxy-data` volume (`/data`, Redis) | yes — same Redis |
| nginx response cache / logs | `proxy-cache` / `proxy-logs` volumes | yes (volume) |
| Secrets (OIDC client secret, LDAP bind password) | `./config/proxy-secrets.js` (bind mount) | your responsibility — back up off-host |

**Automatic snapshots** — when run as part of the unified `theta-env` stack,
`setup.sh` snapshots Redis + `./config/` to `./backups/<timestamp>/` before every
rebuild and keeps the last `BACKUP_KEEP` (default 5). Standalone deployments use
the manual steps below.

**Manual backup**

```bash
# Redis — hot snapshot: trigger a save, then copy the RDB out
docker compose exec proxy redis-cli BGSAVE
docker compose cp proxy:/data/dump.rdb proxy-redis-$(date +%F).rdb

# Secrets — copy the config dir (holds OIDC client secret, LDAP bind password)
cp -a ./config config-backup-$(date +%F) && chmod 700 config-backup-$(date +%F)
```
Store the `.rdb` and config copy **off the host** — they contain secrets and
the whole Host/permission/user dataset.

**Restore — Redis (full proxy state + certs)**

```bash
cp -a config-backup-<date> ./config && chmod 700 ./config
docker compose up -d
docker compose stop proxy
# AOF wins on startup — delete it so the RDB is loaded instead (see note).
docker compose run --rm --no-deps --entrypoint sh proxy -c \
  'rm -f /data/appendonly.aof /data/appendonly.aof.*'
docker compose cp proxy-redis-<date>.rdb proxy:/data/dump.rdb
docker compose start proxy
```

> **AOF vs RDB (important):** with `--appendonly yes`, Redis loads
> `appendonly.aof` on startup and **ignores** `dump.rdb` if the AOF exists. To
> restore from an RDB snapshot you **must delete the AOF first** (the runbook
> does this); Redis then loads the RDB and writes a fresh AOF. Verify:
> `docker compose exec proxy redis-cli DBSIZE`.
>
> Restoring Redis restores cert state **at the snapshot time** — certs issued
> after the snapshot are lost and will be re-issued on next request.

**Upgrades**

```bash
./setup.sh          # backs up, then rebuilds — proxy-data keeps Redis state
# (standalone) docker compose pull && docker compose up -d
```
Host records, permissions, DNS creds, local users, and Let's Encrypt certs all
survive the rebuild because they live on the `proxy-data` volume, not in the
image. **Migrations note:** if a release ships a `nodejs/migrations/` script,
run it after upgrading (it transforms in-Redis records); see the release notes.

### Logs

OpenResty runs in the foreground and the Node app in the background, both
writing to the container's stdout/stderr. nginx access/error logs go to files
(`/var/log/nginx`, on the `proxy-logs` volume), so they do **not** appear in
`docker logs`.

```bash
docker compose logs -f proxy                       # app + OpenResty (stdout/stderr)
docker compose exec proxy tail -f /var/log/nginx/error.log   # nginx errors
docker compose exec proxy tail -f /var/log/nginx/access.log  # nginx access
docker compose logs --tail=200 --since=10m proxy    # recent context
```

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