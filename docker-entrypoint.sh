#!/usr/bin/env bash
# docker-entrypoint.sh — start the theta42/proxy all-in-one container.
#
# Bundles three processes (mirrors the bare-metal ops/install.sh layout):
#   1. Redis            (127.0.0.1:6379) — shared by the node app (model-redis),
#                      lua-resty-auto-ssl cert storage, and targetinfo.lua.
#   2. Node mgmt app    (port 3000 + Unix socket /var/run/proxy_lookup.socket)
#                      — started in the background.
#   3. OpenResty        (80/443/4443) — exec'd in the foreground as PID 2 (under
#                      dumb-init, PID 1) so it receives SIGTERM from `docker stop`.
#
# The app reads its config from conf/base.js deep-merged with a secrets file
# and `app_*` env vars (requires @simpleworkjs/conf >= 1.2.0, pinned in
# nodejs/package-lock.json). No secrets.js is baked into the image. The unified
# theta-env stack mounts ./config/proxy-secrets.js at /config; this entrypoint
# points CONF_SECRETS at it so the app reads oidc/ldap/auth config straight
# from the mounted file (no app_* env needed, no write access to /app/conf
# required). Without the mount, supply the same config via `app_*` env
# (compose `environment:` / `env_file:`).
#
# OpenResty config: the committed ops/nginx_conf/*.conf carry the bare-metal
# home-LAN values (set_real_ip_from 192.168.1.0/24; resolver 192.168.1.1). They
# are copied into the image at build time; this entrypoint sed-substitutes the
# two env-specific values at runtime so the same committed files keep working
# for bare metal (untouched) and Docker (parameterized).

set -e

info()  { echo "[INFO] $*"; }
error() { echo "[ERROR] $*" >&2; }

# ── Optional: mount proxy secrets.js ─────────────────────────────────────────
# When /config/proxy-secrets.js is present (unified theta-env stack, or any
# deployment that bind-mounts ./config), point CONF_SECRETS at it so
# @simpleworkjs/conf reads the oidc/ldap/auth config from the file. No app_*
# env should then be passed — app_* env beats secrets.js in @simpleworkjs/conf
# (precedence: base.js < <env>.js < secrets.js < app_* env), so the file is
# authoritative only if the matching app_* env is absent. When the file is
# absent the app falls back to app_* env (compose environment / env_file).
if [[ -f /config/proxy-secrets.js ]]; then
    export CONF_SECRETS=/config/proxy-secrets.js
    info "Loaded config from /config/proxy-secrets.js (secrets.js authoritative)"
fi

# ── Fallback SSL cert for lua-resty-auto-ssl ─────────────────────────────────
# autossl.conf references /etc/ssl/resty-auto-ssl-fallback.{crt,key} — auto-ssl
# serves this for unknown SNI before a real Let's Encrypt cert is issued.
# Generate on first start (idempotent); mount your own to override.
FALLBACK_CRT=/etc/ssl/resty-auto-ssl-fallback.crt
FALLBACK_KEY=/etc/ssl/resty-auto-ssl-fallback.key
if [[ ! -f "$FALLBACK_CRT" || ! -f "$FALLBACK_KEY" ]]; then
    info "Generating fallback SSL cert for auto-ssl..."
    openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
        -subj '/CN=sni-support-required-for-valid-ssl' \
        -keyout "$FALLBACK_KEY" -out "$FALLBACK_CRT" >/dev/null 2>&1 || {
            error "Failed to generate fallback SSL cert"; exit 1
        }
else
    info "Fallback SSL cert already present"
fi

# ── Parameterize env-specific OpenResty directives ───────────────────────────
# The committed confs hardcode the bare-metal home-LAN values. In Docker the
# proxy is the front (no upstream proxy setting X-Real-IP) and upstream names
# resolve via Docker's embedded DNS.
NGINX_CONF=/usr/local/openresty/nginx/conf/nginx.conf
PROXY_CONF=/usr/local/openresty/nginx/conf/sites-enabled/000-proxy

# RESOLVER: used by proxy_pass for upstream names recorded in Host records.
# Default 127.0.0.11 = Docker's embedded DNS. Set RESOLVER to use a different
# resolver (e.g. 8.8.8.8 for standalone, or your LAN DNS).
RESOLVER="${RESOLVER:-127.0.0.11}"
sed -i "s|resolver 8\.8\.4\.4 8\.8\.8\.8;|resolver ${RESOLVER};|" "$NGINX_CONF"
sed -i "s|resolver 192\.168\.1\.1 ipv6=off;|resolver ${RESOLVER} ipv6=off;|" "$PROXY_CONF"

# REAL_IP_FROM: trusted source range for the X-Real-IP header. Empty (default)
# removes the real_ip block entirely — correct when the proxy is the front
# (clients connect directly, $remote_addr is already the real client, and no
# one is trusted to forge X-Real-IP). Set REAL_IP_FROM to an upstream proxy's IP
# range if something sits in front of this proxy and sets X-Real-IP.
if [[ -z "${REAL_IP_FROM:-}" ]]; then
    info "REAL_IP_FROM unset — proxy is the front; removing real_ip block"
    sed -i '/set_real_ip_from\|real_ip_header\|real_ip_recursive/d' "$PROXY_CONF"
else
    info "REAL_IP_FROM=${REAL_IP_FROM} — trusting X-Real-IP from that range"
    sed -i "s|set_real_ip_from 192\.168\.1\.0/24;|set_real_ip_from ${REAL_IP_FROM};|" "$PROXY_CONF"
fi

# Validate the OpenResty config before starting anything else.
if ! openresty -t >/dev/null 2>&1; then
    error "OpenResty config test failed:"
    openresty -t || true
    exit 1
fi

# ── Redis ───────────────────────────────────────────────────────────────────
# Persisted to /data (AOF + RDB) so Host records, permissions, DNS creds, local
# users, AND the lua-resty-auto-ssl Let's Encrypt certs all survive container
# recreation (persisting Redis persists the cert store — avoids LE re-issue /
# rate limits on rebuild). The app, auto-ssl, and targetinfo.lua all reach it at
# 127.0.0.1:6379 (the redis client default + the one literal in targetinfo.lua).
# Run in the background (--daemonize no, backgrounded by the shell); the
# container's lifecycle is owned by OpenResty (exec'd below), and
# `restart: unless-stopped` in compose handles full restarts.
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/data}"
mkdir -p "$REDIS_DATA_DIR"
chmod 700 "$REDIS_DATA_DIR"
info "Starting Redis (AOF persisted to $REDIS_DATA_DIR)..."
redis-server --daemonize no --dir "$REDIS_DATA_DIR" --appendonly yes \
    --appendfilename appendonly.aof --save 900 1 --save 300 10 --save 60 10000 \
    --dbfilename dump.rdb &
REDIS_PID=$!
for i in $(seq 1 15); do
    if redis-cli ping >/dev/null 2>&1; then info "Redis is ready"; break; fi
    sleep 0.5
done
if ! redis-cli ping >/dev/null 2>&1; then
    error "Redis failed to start"; exit 1
fi

# ── Node management app ──────────────────────────────────────────────────────
# Matches ops/proxy.service: NODE_ENV=production, runs as root (the Unix socket
# is chmod'd 777 by the app so OpenResty's nobody workers can connect).
export NODE_ENV="${NODE_ENV:-production}"
export NODE_PORT="${NODE_PORT:-3000}"
info "Starting proxy management app on port ${NODE_PORT}..."
node bin/www &
NODE_PID=$!

# Give the app a moment to bind the socket + port before OpenResty fields
# requests that may fall back to the socket for host lookups.
for i in $(seq 1 20); do
    if curl -fsS http://localhost:${NODE_PORT}/health >/dev/null 2>&1; then
        info "Management app is ready"
        break
    fi
    sleep 0.5
done

# ── OpenResty (foreground, primary process) ──────────────────────────────────
info "Starting OpenResty..."
# Replace the shell with openresty in the foreground so dumb-init forwards
# SIGTERM to it. When OpenResty exits the container stops, taking the
# backgrounded redis + node with it; `restart: unless-stopped` in compose
# handles full restarts.
exec openresty -g 'daemon off;'