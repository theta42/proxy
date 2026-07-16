#!/bin/bash
# Standalone backup for a Docker-deployed proxy (container name "proxy").
#
# Snapshots Redis (Host records, permissions, DNS creds, local users,
# lua-resty-auto-ssl certs) and ./config (secrets) to ./backups/<timestamp>/,
# then prunes old backups beyond BACKUP_KEEP.
#
# If you run proxy as part of the unified theta-env stack, use theta-env's
# own setup.sh instead -- it already does this (and more) before every
# rebuild. This script is for a standalone `docker compose up` deployment.
#
# Usage: ./ops/backup.sh [BACKUP_KEEP]
#   BACKUP_KEEP  how many timestamped backups to retain (default 5; env var
#                of the same name also works, matching theta-env's setup.sh)

set -euo pipefail

CONTAINER="${CONTAINER:-proxy}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
BACKUP_KEEP="${1:-${BACKUP_KEEP:-5}}"

info() { printf '\033[1;34m[backup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[backup]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[backup]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker not found"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "container '$CONTAINER' not found -- is the stack running? (docker compose up -d)"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
dest="${BACKUP_ROOT}/${ts}"
mkdir -p "$dest"
chmod 700 "$dest"

info "Snapshotting Redis (BGSAVE)..."
# Capture LASTSAVE *before* issuing BGSAVE: a small dataset finishes in well
# under a second, so capturing it afterward races the save and the poll below
# can miss the update entirely (looks like "BGSAVE never finished" when it
# actually finished immediately).
before="$(docker exec "$CONTAINER" redis-cli LASTSAVE 2>/dev/null | tr -dc '0-9' || echo 0)"
docker exec "$CONTAINER" redis-cli BGSAVE >/dev/null 2>&1 || true
ok=0
for _ in $(seq 1 10); do
	after="$(docker exec "$CONTAINER" redis-cli LASTSAVE 2>/dev/null | tr -dc '0-9' || echo 0)"
	if [ "${after:-0}" -gt "${before:-0}" ]; then ok=1; break; fi
	sleep 1
done
if [ "$ok" != "1" ]; then
	# BGSAVE didn't advance LASTSAVE in time (fork failure, or a save already
	# in progress) -- fall back to a synchronous SAVE. Reply must be "OK".
	info "BGSAVE didn't complete in time -- falling back to a synchronous SAVE."
	[ "$(docker exec "$CONTAINER" redis-cli SAVE 2>/dev/null | tr -d '\r\n')" = "OK" ] && ok=1
fi

if [ "$ok" = "1" ]; then
	# Ask Redis where it actually wrote the RDB rather than assuming /data --
	# works regardless of the container's working directory.
	rdir="$(docker exec "$CONTAINER" redis-cli CONFIG GET dir 2>/dev/null | sed -n '2p' | tr -d '\r\n')"
	rfile="$(docker exec "$CONTAINER" redis-cli CONFIG GET dbfilename 2>/dev/null | sed -n '2p' | tr -d '\r\n')"
	rpath="${rdir:+$rdir/}${rfile:-dump.rdb}"
	if docker cp "${CONTAINER}:${rpath}" "${dest}/proxy.rdb" >/dev/null 2>&1; then
		info "  -> ${dest}/proxy.rdb"
	else
		warn "  could not copy ${rpath} from the container -- Redis not snapshotted"
	fi
else
	warn "  Redis snapshot failed -- not included in this backup"
fi

if [ -d ./config ]; then
	info "Copying ./config..."
	cp -a ./config "${dest}/config"
	info "  -> ${dest}/config"
else
	warn "No ./config directory found here -- skipping (secrets aren't managed from this path?)."
fi

if [ -n "${BACKUP_KEEP}" ] && [ "${BACKUP_KEEP}" -gt 0 ] 2>/dev/null; then
	info "Pruning old backups, keeping the newest ${BACKUP_KEEP}..."
	# Newest-first, drop everything after the Nth.
	# shellcheck disable=SC2012
	ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n "+$((BACKUP_KEEP + 1))" | while read -r old; do
		[ -L "${old%/}" ] && continue
		info "  removing ${old}"
		rm -rf "${old}"
	done
fi

info "Done: ${dest}"
info "Store this off-host -- it contains the OIDC client secret, LDAP bind password, and Let's Encrypt account state."
