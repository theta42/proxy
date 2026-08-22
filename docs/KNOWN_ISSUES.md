# Theta Suite Known Issues

This document outlines known operational footguns, security tradeoffs, and behavioral sharp edges present in the current architecture.

## Operational Footguns

* **Fire-and-Forget Replication**: Multi-site replication currently has no catch-up guarantee. There are no acknowledgments, no queues, and no retry logic. A spoke that is offline during a write will only converge when the next write fires a ping it happens to receive, or if an administrator manually clicks "Sync now". Staleness is invisible unless you specifically check the `last_seen_on` timestamp.
* **Manual Mesh Peering**: WireGuard mesh peering is manual by design. A spoke with zero-inbound AND zero-outbound access cannot join the mesh at all.
* **254-Site Hard Ceiling**: The system has a hard ceiling of 254 sites. The `siteId` octet is strictly tied to the WireGuard address octet and the LDAP ServerID, establishing a limit far below LDAP's own capabilities.

## Security Tradeoffs (Accepted & Documented)

* **Identical Ed25519 Signing Keys**: Every site uses an identical Ed25519 signing key. A compromise of the smallest, least-patched spoke grants full cluster Command and Control (C2) authority (including `arbitrary_bash` and service control) over every agent. This is acceptable for a small dozen of trusted sites, but generalizing this pattern to larger deployments is explicitly forbidden.
* **Widespread Join Key**: The join key is a cluster-wide credential that is pasted into every `spoke.env` file. While it was briefly accepted for inter-site authentication via `X-Forwarded-User` (impersonating anyone, including `god_admin`), this was fixed on 2026-08-18 to use a per-spoke `pushToken` and `X-Forwarded-Spoke` match. However, the key itself remains widely distributed in configuration files.
* **Plaintext pushTokens**: `pushTokens` live in plaintext on the master. This is justified as the sender must re-present them, similar to a Webhook secret.

## Behavioral Sharp Edges

* **Write-Forwarding Allowlist Surprises**: OAuth clients, AccessRequests, and plugin instances created at a spoke are intentionally local-only. They are invisible to the rest of the cluster ("forward only what replicates back"). This means the single-pane-of-glass experience is not fully absolute.
* **Master Unreachability**: A spoke paired with an unreachable master will result in a 503 read-only state for forwarded writes. While users and groups will continue to function via MMR (Multi-Master Replication), writes to the catalog, PATs, or agents will fail.

