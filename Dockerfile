# Theta42 Proxy — All-in-One Dockerfile
# OpenResty (front) + Node management app + Redis in a single container, mirroring
# the bare-metal ops/install.sh layout. Intended for self-contained single-node
# deployments (home labs / small businesses). Each process is supervised by
# dumb-init (PID 1); redis + the node app run in the background and OpenResty
# runs in the foreground as the primary process.
#
# Base image: the official openresty/openresty "-fat" variant bundles luarocks
# preconfigured for OpenResty's luajit, so `luarocks install` places rocks into
# /usr/local/openresty/lualib (which is on OpenResty's package.path) — no manual
# --lua-dir/--tree wrangling needed.

# ── Git commit hash (build-time only) ────────────────────────────────────────
# The final image intentionally has no git binary and no .git directory (kept
# lean, per .dockerignore), so `git rev-parse` always fails at runtime and
# build_info.js silently fell back to "unknown". Resolve it here instead,
# where .git IS available (build context), and bake just the short hash into
# a file — this stage itself is discarded, only /commit.txt survives via the
# COPY --from below. Reuses the main base image (already pulled for the real
# build below) rather than a separate one, so this adds no extra image pull.
#
# GIT_COMMIT lets a caller override the resolved hash instead of computing it
# from .git in this build context. Needed when this repo is built as a git
# submodule (e.g. from theta-env): a submodule's .git is a pointer FILE, not
# a directory — the real object database lives in the superproject's
# .git/modules/, outside this repo's own directory and therefore outside
# Docker's build context entirely, so `git rev-parse` can never resolve it
# from in here no matter what. theta-env's setup.sh passes
# --build-arg GIT_COMMIT=$(git -C proxy rev-parse --short HEAD), computed on
# the host where the submodule resolves correctly.
ARG GIT_COMMIT=""
FROM openresty/openresty:1.31.1.1-2-bookworm-fat AS gitinfo
ARG GIT_COMMIT
WORKDIR /repo
COPY .git ./.git
RUN if [ -n "$GIT_COMMIT" ]; then \
        echo "$GIT_COMMIT" > /commit.txt; \
    else \
        { apt-get update && apt-get install -y --no-install-recommends git \
        && git rev-parse --short HEAD > /commit.txt; } 2>/dev/null || echo unknown > /commit.txt; \
    fi

FROM openresty/openresty:1.31.1.1-2-bookworm-fat

# ── Tooling needed before adding apt repos ──────────────────────────────────
# The -fat base image lacks gnupg, which the NodeSource keyring setup needs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 22.x (NodeSource) ────────────────────────────────────────────────
# The management app + its native deps (bcrypt) need Node. Matches
# ops/install.sh NODE_MAJOR=22.
RUN install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list

# ── System packages ──────────────────────────────────────────────────────────
#   build-essential g++ make python3 : native addon build for bcrypt
#   libpam0g-dev                     : native build for linux-sys-user
#   redis-server                      : bundled Redis (the app + lua-resty-auto-ssl
#                                       + targetinfo.lua all reach 127.0.0.1:6379)
#   dumb-init                         : PID 1 zombie reaping + signal forwarding
#   openssl lsb-release wget           : tooling
#   nodejs                            : Node 22.x runtime
# luarocks ships in the -fat base image (configured for OpenResty's luajit).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential g++ make python3 \
        libpam0g-dev \
        redis-server \
        dumb-init \
        openssl lsb-release wget \
        nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Lua modules ──────────────────────────────────────────────────────────────
# lua-resty-auto-ssl : Let's Encrypt automation (certs stored in the bundled redis)
# luasocket          : socket helpers used by auto-ssl
# lua-resty-ipmatcher: CIDR matching for per-host IP allow/deny (hostfeatures.lua)
# resty.limit.req is bundled with OpenResty, so no rock is needed for it.
RUN luarocks install lua-resty-auto-ssl \
    && luarocks install luasocket \
    && luarocks install lua-resty-ipmatcher

# ── Node app ─────────────────────────────────────────────────────────────────
WORKDIR /app

# Install production deps first (layer cache: only rebuilds when package*.json
# changes). .dockerignore excludes nodejs/node_modules.
COPY nodejs/package*.json ./
RUN npm ci --omit=dev

# App source (mirror sso-manager's layout — flattened into /app).
COPY nodejs/app.js ./
COPY nodejs/bin ./bin
COPY nodejs/conf ./conf
COPY nodejs/controller ./controller
COPY nodejs/middleware ./middleware
COPY nodejs/migrations ./migrations
COPY nodejs/models ./models
COPY nodejs/routes ./routes
COPY nodejs/services ./services
COPY nodejs/utils ./utils
COPY nodejs/views ./views
COPY nodejs/public ./public

# Baked commit hash from the gitinfo stage (see build_info.js).
COPY --from=gitinfo /commit.txt ./.build_commit

# ── OpenResty config (mirrors ops/install.sh symlink targets) ─────────────────
# The default OpenResty config lives at /usr/local/openresty/nginx/conf/nginx.conf
# (the prefix conf dir); relative `include` directives resolve there. We place:
#   nginx.conf   -> prefix conf dir (overwrites the stock config)
#   autossl.conf -> prefix conf dir (included by proxy.conf)
#   proxy.conf   -> prefix conf dir/sites-enabled/000-proxy (included by nginx.conf)
#   *.lua        -> /usr/local/openresty/lualib (on OpenResty's package.path)
# The entrypoint sed-substitutes the env-specific real_ip/resolver values into
# the copied files at runtime, so the committed confs (which carry the bare-metal
# home-LAN values) are left untouched for bare-metal use.
RUN install -d /usr/local/openresty/nginx/conf/sites-enabled
COPY ops/nginx_conf/nginx.conf       /usr/local/openresty/nginx/conf/nginx.conf
COPY ops/nginx_conf/autossl.conf     /usr/local/openresty/nginx/conf/autossl.conf
COPY ops/nginx_conf/proxy.conf       /usr/local/openresty/nginx/conf/sites-enabled/000-proxy
COPY ops/nginx_conf/targetinfo.lua   /usr/local/openresty/lualib/targetinfo.lua
COPY ops/nginx_conf/hostfeatures.lua /usr/local/openresty/lualib/hostfeatures.lua

# ── Runtime dirs ─────────────────────────────────────────────────────────────
# nginx.conf writes access/error logs to /var/log/nginx and uses a response
# cache at /var/cache/nginx/proxy. OpenResty workers run as `nobody` (the
# compiled-in default — nginx.conf leaves `user` commented), so the cache dir
# must be owned by nobody:nogroup for proxy_cache_path to write to it. The node
# app creates /var/run/proxy_lookup.socket and chmods it 777 so the nobody
# workers can connect (see utils/unix_socket_json.js).
RUN install -d -m 0755 -o nobody -g nogroup /var/cache/nginx/proxy \
    && install -d /var/log/nginx /var/run /etc/ssl

# ── Entrypoint ───────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 80/443/4443 : public proxy listeners (autossl.conf)
# 3000        : node management API + web UI (internal; the OpenResty front
#               proxies /api/* and the UI. Expose it for first-run access /
#               healthcheck — bind to localhost only in production via compose.)
EXPOSE 80 443 4443 3000

# Healthcheck: the node app's /health (added in routes/render.js). Confirms the
# management process is up and routing; OpenResty liveness is implied because it
# proxies /api/auth -> the node app.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:3000/health || exit 1

# dumb-init reaps zombies and forwards SIGTERM to the OpenResty process the
# entrypoint execs into, so `docker stop` shuts down cleanly instead of hitting
# the 10s kill timeout.
ENTRYPOINT ["dumb-init", "/usr/local/bin/docker-entrypoint.sh"]

# The entrypoint starts redis + the node app in the background, then execs
# `openresty -g 'daemon off;'` in the foreground as the primary process.
CMD ["openresty", "-g", "daemon off;"]