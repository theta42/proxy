#!/usr/bin/env bash
#
# Install / update the Theta42 proxy on a fresh or existing host.
#
# This script is idempotent: run it to install, and re-run it to update. It
# installs system dependencies (Node, OpenResty, Redis, Lua modules), force-syncs
# the repo at $REPO_DIR to its remote branch, and symlinks the OpenResty and
# systemd config straight from the repo. Because the config is symlinked, an
# update is just "sync the repo + reload" -- the files under /etc always track
# the repo, so there is nothing to re-copy.
#
# Secrets live at $SECRETS_FILE (/etc/proxy/secrets.js by default), outside the
# repo checkout so they survive the hard reset below. First run seeds it from
# secrets.js.example (placeholders you must fill in); later runs never touch
# an existing file.
#
# Intended to be driven by CI/CD with no human writes on prod: the checkout is
# hard-reset to origin/$BRANCH on every run, so the box deterministically mirrors
# the repo (any drift on the box is discarded).
#
# Usage: sudo ./install.sh   (override with REPO_URL=, REPO_DIR=, BRANCH=,
#                             SECRETS_FILE=)
set -euo pipefail
# Never block on an interactive git credential prompt in CI.
export GIT_TERMINAL_PROMPT=0
# Never block on an interactive debconf prompt (e.g. tzdata, pulled in as a
# dependency on a box that's never configured it).
export DEBIAN_FRONTEND=noninteractive

REPO_URL="${REPO_URL:-https://github.com/theta42/proxy.git}"
REPO_DIR="${REPO_DIR:-/opt/theta42/proxy}"
BRANCH="${BRANCH:-master}"
NODE_MAJOR=22
SECRETS_FILE="${SECRETS_FILE:-/etc/proxy/secrets.js}"

if [ "$(id -u)" -ne 0 ]; then
	echo "This script must be run as root (try: sudo $0)" >&2
	exit 1
fi

# Symlink $1 -> $2, replacing whatever is already at $2 (idempotent).
link(){
	ln -sfn "$1" "$2"
	echo "linked $2 -> $1"
}

# Read the "version" field out of a package.json without depending on Node
# being installed yet (this runs before the Node.js install step below).
pkg_version(){
	sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1
}

# Installed version before this run touches anything, for the upgrade banner
# at the end. Empty on a fresh install (no prior checkout).
CURRENT_VERSION=""
if [ -f "$REPO_DIR/nodejs/package.json" ]; then
	CURRENT_VERSION="$(pkg_version "$REPO_DIR/nodejs/package.json")"
fi

echo "==> Base packages"
apt-get update
apt-get install -y --no-install-recommends \
	libpam0g-dev build-essential redis-server luarocks \
	wget gnupg ca-certificates curl git lsb-release

echo "==> Node.js ${NODE_MAJOR}.x apt source"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
	| gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
	> /etc/apt/sources.list.d/nodesource.list

echo "==> OpenResty apt source"
# openresty.org ships distinct trees (and components) for Debian vs Ubuntu.
# Debian tree: component "openresty", published only up to "bookworm" (no
# trixie block) — so on a newer Debian host use the host codename when it's
# published, else fall back to bookworm (binary-compatible with trixie, same
# OpenSSL 3 era). Ubuntu tree: component "main", use the host codename.
. /etc/os-release 2>/dev/null || true
CODENAME="$(lsb_release -sc 2>/dev/null || echo "")"
case "${ID:-}" in
	debian)
		OR_REPO_PATH="package/debian"
		OR_COMPONENT="openresty"
		case "$CODENAME" in
			jessie|stretch|buster|bullseye|bookworm) OR_DISTRO="$CODENAME" ;;
			*)                                        OR_DISTRO="bookworm" ;;
		esac
		;;
	*)
		OR_REPO_PATH="package/ubuntu"
		OR_DISTRO="$CODENAME"
		OR_COMPONENT="main"
		;;
esac
install -d -m 0755 /usr/share/keyrings
wget -qO- https://openresty.org/package/pubkey.gpg \
	| gpg --dearmor --yes -o /usr/share/keyrings/openresty.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/${OR_REPO_PATH} ${OR_DISTRO} ${OR_COMPONENT}" \
	> /etc/apt/sources.list.d/openresty.list

# Debian 13 (trixie) tightened apt's sequoia GPG backend to reject SHA-1
# signatures, but the OpenResty repo signing key is still SHA-1 — so the next
# apt-get update would refuse the repo ("unsignable" / weak digest). Extend
# the SHA-1 acceptance window via a back-end override. The source config only
# ships on Debian 13+, so this is a no-op on older Debian / Ubuntu. Idempotent:
# re-runs re-copy the default and re-extend it.
if [ -f /usr/share/apt/default-sequoia.config ]; then
	install -d -m 0755 /etc/crypto-policies/back-ends
	cp -f /usr/share/apt/default-sequoia.config /etc/crypto-policies/back-ends/apt-sequoia.config
	sed -i 's/2026-02-01/2028-02-01/' /etc/crypto-policies/back-ends/apt-sequoia.config
	if grep -q '2028-02-01' /etc/crypto-policies/back-ends/apt-sequoia.config; then
		echo "    extended apt sequoia SHA-1 acceptance to 2028 (OpenResty key is SHA-1)"
	else
		echo "    WARNING: sequoia override did not apply (config date string changed?) — apt update may reject the OpenResty repo" >&2
	fi
fi

echo "==> Install Node.js + OpenResty"
apt-get update
apt-get install -y nodejs openresty

echo "==> Lua modules"
luarocks install lua-resty-auto-ssl
luarocks install luasocket
luarocks install lua-resty-balancer
# CIDR matcher for the per-host IP allow/deny lists (hostfeatures.lua).
# resty.limit.req is bundled with OpenResty, so no rock is needed for it.
luarocks install lua-resty-ipmatcher

echo "==> Proxy response-cache directory"
# Must be writable by the OpenResty worker user. nginx.conf sets no `user`
# directive, so workers run as the compiled-in default (nobody); own the dir to
# match so proxy_cache_path can write to it.
install -d -m 0755 -o nobody -g nogroup /var/cache/nginx/proxy

echo "==> Fallback SSL cert"
install -d /etc/ssl
if [ ! -f /etc/ssl/resty-auto-ssl-fallback.crt ]; then
	openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
		-subj '/CN=sni-support-required-for-valid-ssl' \
		-keyout /etc/ssl/resty-auto-ssl-fallback.key \
		-out /etc/ssl/resty-auto-ssl-fallback.crt
else
	echo "fallback cert already present, skipping"
fi

echo "==> Repo checkout at ${REPO_DIR} (branch ${BRANCH})"
install -d "$(dirname "$REPO_DIR")"
if [ -d "$REPO_DIR/.git" ]; then
	# Force the box to match the remote branch exactly. No human edits configs
	# on prod, so discarding local drift is the desired, deterministic behavior.
	git -C "$REPO_DIR" fetch --prune origin
	git -C "$REPO_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
	git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
	git -C "$REPO_DIR" clean -fd
else
	git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
fi

NEW_VERSION="$(pkg_version "$REPO_DIR/nodejs/package.json")"

echo "==> Secrets file at ${SECRETS_FILE}"
install -d -m 0750 "$(dirname "$SECRETS_FILE")"
if [ ! -f "$SECRETS_FILE" ]; then
	cp "$REPO_DIR/secrets.js.example" "$SECRETS_FILE"
	chmod 600 "$SECRETS_FILE"
	echo "    seeded ${SECRETS_FILE} from secrets.js.example -- EDIT IT before the proxy will work:"
	echo "        \$EDITOR ${SECRETS_FILE}"
	echo "    then re-run this script (or: sudo systemctl restart proxy)"
else
	echo "    ${SECRETS_FILE} already exists, leaving it untouched"
fi

echo "==> Symlink config from the repo"
install -d /etc/openresty/sites-enabled /var/log/nginx
link "$REPO_DIR/ops/nginx_conf/nginx.conf"     /etc/openresty/nginx.conf
link "$REPO_DIR/ops/nginx_conf/autossl.conf"   /etc/openresty/autossl.conf
link "$REPO_DIR/ops/nginx_conf/proxy.conf"     /etc/openresty/sites-enabled/000-proxy
link "$REPO_DIR/ops/nginx_conf/targetinfo.lua" /usr/local/openresty/lualib/targetinfo.lua
link "$REPO_DIR/ops/nginx_conf/hostfeatures.lua" /usr/local/openresty/lualib/hostfeatures.lua
link "$REPO_DIR/ops/proxy.service"             /etc/systemd/system/proxy.service

echo "==> Node dependencies"
# Deterministic, production-only install from the lockfile. Falls back to a
# plain install if the lockfile and manifest are out of step.
( cd "$REPO_DIR/nodejs" && { npm ci --omit=dev || npm install --omit=dev; } )

echo "==> Services"
systemctl daemon-reload
systemctl enable --now proxy.service
systemctl restart proxy.service

# Validate the OpenResty config before (re)starting so a bad edit can't take
# the proxy down; reload if already running, otherwise start it.
if openresty -t; then
	systemctl reload openresty 2>/dev/null || systemctl restart openresty
else
	echo "openresty config test FAILED -- not reloading" >&2
	exit 1
fi

echo "==> Done."
if [ -z "$CURRENT_VERSION" ]; then
	echo "    Installed v${NEW_VERSION}."
elif [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
	echo "    Already up to date (v${NEW_VERSION})."
else
	echo "    Updated v${CURRENT_VERSION} -> v${NEW_VERSION}."
fi
echo "    Update later with: sudo BRANCH=${BRANCH} $0"
