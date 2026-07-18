# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
correspond to git tags (`vX.Y.Z`) and `nodejs/package.json`'s `version`.

## [Unreleased]

## [1.1.14] - 2026-07-17

### Changed
- Bumped `@simpleworkjs/conf` to 1.2.0 and `jq-repeat` to 2.2.0. The Docker entrypoint now sets the new `CONF_SECRETS` env var to point directly at a mounted `proxy-secrets.js` instead of symlinking it into `/app/conf/secrets.js` — the app no longer needs write access to its own `conf/` directory to pick up mounted secrets.

## [1.1.13] - 2026-07-17

### Added
- Four new plain-language docs aimed at less technical readers, replacing the system-design-level Architecture/Installation docs as the target of most card help links: **Hosts & HTTPS**, **DNS Providers**, **Users, Groups & Permissions**, and **API Tokens**. Each links onward to the deeper technical reference for readers who want it; the technical docs link back the other way too. The personal-access-token card (previously missed entirely) now has a help link.

### Fixed
- The in-app docs viewer rendered every `docs/*.md` page with a garbled heading and a stray horizontal rule at the top — Jekyll front matter (meant only for the GitHub Pages build) was never stripped before being handed to the markdown renderer. Also fixed: cross-doc links never resolved in-app, since this viewer serves docs at `/docs/<slug>` with no `.html` suffix — they're now rewritten to the correct in-app URL (by registered slug, falling back to the doc's real filename), the same way image paths already were.

## [1.1.12] - 2026-07-17

### Fixed
- The host edit form's "Parent Wildcard" option stayed greyed out even when a valid wildcard actually existed for that host, so an already-created host could never be switched onto one from the edit modal (only brand-new hosts, via the field's `keyup` handler, ever saw it become available). The underlying `/host/lookup/:item` check also had the same self-match issue as the recently-fixed backend bug: it resolved an already-existing host to its own record instead of a sibling wildcard. Added a dedicated `/host/wildcard-parent/:item` endpoint that checks both directions, and the edit form now actually runs the check when it opens.
- Fixed an nginx startup warning: `the "listen ... http2" directive is deprecated, use the "http2" directive instead`. Migrated to the standalone `http2 on;` directive (nginx 1.25.1+).

## [1.1.11] - 2026-07-17

### Changed
- Moved the help (❓) link out of the global header and onto each relevant card individually (Proxy List, Add/Edit host, Add DNS Provider, Dynamic A Records, Add New User, User List, Add Permission, Permissions, Add Group) — each now deep-links straight to the doc that actually covers it, instead of one generic header icon.

## [1.1.10] - 2026-07-17

### Added
- A help icon (❓) in the top-right header now deep-links to the doc most relevant to the current page (falls back to the docs index elsewhere).
- The in-app docs viewer (`/docs`) is now searchable — a simple line-substring search over the same local doc set, no new dependency, still works with no internet access.

## [1.1.9] - 2026-07-17

### Added
- The host list now shows who created each host, and when.
- Plain (non-wildcard) hosts can now be renamed after creation — the hostname field is no longer permanently locked. Wildcard hosts, wildcard children, and auto-created subdomain cache entries stay locked, since other records reference them by name.
- More inline help text on the host create/edit form (Target SSL, wildcard matching behavior).

### Fixed
- The host create/edit modal's tabs could overflow awkwardly on narrow (mobile) screens — they now scroll horizontally instead.
- Fixed a bug in the vendored `model-redis` library's record-rename path: renaming a record's primary key while another `always`-type field (e.g. `updated_on`) is defined earlier in the schema left a stray, incomplete hash behind under the old key, making that name permanently unavailable for reuse. Worked around in `Host.prototype.update()`.

## [1.1.8] - 2026-07-17

### Fixed
- **Couldn't attach an existing host to a parent wildcard.** The host edit form's "Parent Wildcard" option submitted correctly, but `Host.prototype.update()` had no `challengeType` handling at all (only `Host.create()` did) — selecting it and saving silently did nothing. Added the same wildcard-parent lookup to `update()`.
- **Couldn't register a wildcard's own base domain as a host.** A wildcard cert's `altNames` already cover both the base domain and `*.base domain`, but the lookup tree stores the wildcard one level below its base domain, and a lookup for the bare base domain landed on that empty parent node and found nothing — even though the already-issued cert covers it. `buildLookUpObj()` now also stamps the parent node so this resolves correctly, without re-issuing or duplicating the cert.

Both required a corrected lookup: attaching an *existing* host (which already has its own tree leaf) needed a new `Host.lookUpWildcardParent()` that checks the sibling wildcard slot instead of resolving to the host's own record.

## [1.1.7] - 2026-07-16

### Changed
- Redesigned the GitHub Pages docs site to match the app's own look (dark navbar/footer, Bootstrap 5, Font Awesome) instead of the generic `jekyll-theme-cayman` theme, added a real cross-page nav, SEO (`jekyll-seo-tag` + `jekyll-sitemap`, per-page descriptions, OG/Twitter tags, sitemap.xml, robots.txt), and mobile-responsive layout.

## [1.1.6] - 2026-07-16

### Fixed
- Hosts admin UI's Authentication tab radios (Off / Basic / SSO) had no shared `name`, so clicking one didn't uncheck the others -- multiple options could appear selected at once. Added `name="auth_mode"` to restore standard exclusive radio-group behavior.

## [1.1.5] - 2026-07-16

### Fixed
- Bumped `jq-repeat` 2.0.1 -> 2.1.0. Fixed real breakage: `users.ejs`/`groups.ejs`/`permissions.ejs` called the removed `$.scope.X.__setPut(fn)`/`__setTake(fn)` setter-method API; insert/remove row hooks are now set via direct property assignment (`$.scope.X.__put = fn`), matching 2.1.0's API.

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

[Unreleased]: https://github.com/theta42/proxy/compare/v1.1.14...HEAD
[1.1.14]: https://github.com/theta42/proxy/compare/v1.1.13...v1.1.14
[1.1.13]: https://github.com/theta42/proxy/compare/v1.1.12...v1.1.13
[1.1.12]: https://github.com/theta42/proxy/compare/v1.1.11...v1.1.12
[1.1.11]: https://github.com/theta42/proxy/compare/v1.1.10...v1.1.11
[1.1.10]: https://github.com/theta42/proxy/compare/v1.1.9...v1.1.10
[1.1.9]: https://github.com/theta42/proxy/compare/v1.1.8...v1.1.9
[1.1.8]: https://github.com/theta42/proxy/compare/v1.1.7...v1.1.8
[1.1.7]: https://github.com/theta42/proxy/compare/v1.1.6...v1.1.7
[1.1.6]: https://github.com/theta42/proxy/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/theta42/proxy/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/theta42/proxy/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/theta42/proxy/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/theta42/proxy/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/theta42/proxy/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/theta42/proxy/releases/tag/v1.1.0
