# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
correspond to git tags (`vX.Y.Z`) and `nodejs/package.json`'s `version`.

## [Unreleased]

## [1.1.4] - 2026-07-16

### Added
- **White-label**: `<title>`, the navbar brand text, and the nav logo image were hardcoded "Proxy - Theta 42"/"Dynamic Proxy". Now driven by new `conf.name`/`conf.logo` keys (defaults unchanged). Footer attribution (copyright, `theta42.com` link, GitHub/license links) and favicon are left as-is. Closes [#45](https://github.com/theta42/proxy/issues/45).

## [1.1.3] - 2026-07-16

### Added
- `CHANGELOG.md` (this file), backfilled from the release notes for every tag so far and served in-app at `/docs/changelog`. Closes [theta-env#43](https://github.com/theta42/theta-env/issues/43).

## [1.1.2] - 2026-07-16

### Fixed
- **Air-gap**: `DynamicRecord.refreshAll()` called the public-IP resolvers (`api.ipify.org`, `icanhazip.com`, `ifconfig.me`) every 4h on a timer regardless of whether any dynamic DNS records were configured — the one background network call in the repo not actually gated by feature use. Now skips the lookup entirely when there's nothing to refresh.
- Removed the stray, unauthenticated `GET /test` page (a leftover jq-repeat demo) that loaded jQuery + Mustache from external CDNs.
- Removed a dead IE<9-only `html5shim` script tag pointing at a domain that no longer resolves.

### Added
- **In-app documentation**: `GET /docs` and `GET /docs/:slug` render this project's own README, DEPLOYMENT, `api.md`, and `docs/*.md` server-side — readable from the running app with no dependency on GitHub Pages, which requires internet access to view. Public, no auth, rate-limited.

## [1.1.1] - 2026-07-16

### Fixed
- **DuckDNS provider**: adding a DuckDNS provider no longer pushes this host's public IP to the domain's live A/AAAA record as a side effect of token validation. Validation now writes a fixed marker to the TXT record instead, leaving routing untouched. ([#142](https://github.com/theta42/proxy/pull/142))

## [1.1.0] - 2026-07-16

First tagged release. Establishes the `vX.Y.Z` tag convention that the in-app update-check banner polls against going forward.

### Added
- Standalone backup script (`ops/backup.sh`) for deployments not using theta-env's orchestrator — snapshots Redis and `./config`, with retention.
- Admin-only in-app banner that checks GitHub releases every 24h and surfaces available updates.

[Unreleased]: https://github.com/theta42/proxy/compare/v1.1.4...HEAD
[1.1.4]: https://github.com/theta42/proxy/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/theta42/proxy/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/theta42/proxy/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/theta42/proxy/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/theta42/proxy/releases/tag/v1.1.0
