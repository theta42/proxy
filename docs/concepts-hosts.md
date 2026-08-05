---
layout: default
title: Hosts & HTTPS
description: A plain-language guide to hosts, HTTPS certificates, and wildcards in theta42/proxy.
---

# Hosts & HTTPS

This page explains, in plain language, what a "host" is and how this app
gets you working HTTPS without you having to think about certificates. For
the deeper system-design detail, see [Architecture](architecture.html); for
step-by-step setup, see [Installation](installation.html).

## What's a "host"?

A **host** is one entry telling the proxy: "when someone requests *this*
public address, send them to *that* server." For example: requests for
`photos.example.com` get sent to the little box in your closet running your
photo app on port 8080. Each app or service you want to reach from outside
your network — a home automation dashboard, a media server, this proxy's
own management UI — gets its own host entry.

Two settings on a host are easy to mix up:

- **Incoming host name** — the public address people type in their
  browser (`photos.example.com`).
- **Target IP/port** — where the proxy actually sends the request behind
  the scenes (`10.0.0.5:8080`, or a hostname like `photo-server`).

Everything else on the host form (traffic limits, access rules,
authentication) is optional — a bare host with just those two fields
already works.

## HTTPS certificates: mostly automatic

Every public website needs an HTTPS certificate so browsers show the lock
icon instead of a scary warning. This app gets one for you automatically
from [Let's Encrypt](https://letsencrypt.org) the first time a host is
actually requested — you don't manually request, install, or renew
anything for a normal host. This happens behind the scenes using a method
called **HTTP-01**, and it's the default for every new host.

## Wildcards: one certificate for a whole family of hosts

Sometimes you want *every* subdomain under one name to work — `app1.`,
`app2.`, `anything.example.com` — without registering each one by hand and
waiting for its own certificate. That's what a **wildcard** host does: a
single host entry named `*.example.com` gets one certificate that covers
the whole family at once. Setting one up needs one extra piece of
information the automatic method above doesn't need — see
[DNS Providers](concepts-dns.html) for why.

Once a wildcard exists, you have two ways to actually use it:

- **Register nothing else, and turn on "Match any subdomain"** on the
  wildcard host itself — *any* subdomain that doesn't already have its own
  entry gets automatically routed to the wildcard's target the first time
  it's requested. Convenient, but it means literal typos and random scan
  traffic get routed too, not just the subdomains you meant to use.
- **Register each subdomain as its own host, as a "Parent Wildcard"
  child** — more setup, but each subdomain can point at a different
  target/server while still reusing the one wildcard certificate instead
  of getting its own. This is the recommended default and is what
  "Match only subdomains defined here" (the host form's default) does.

You'll see the **"Parent Wildcard"** option light up automatically on the
host form whenever the name you're entering already has a matching
wildcard available to reuse — including the wildcard's own bare base
domain (e.g. `example.com` itself, not just `something.example.com`).

## Putting a host behind single sign-on

Each host can be gated on its own, independently of the proxy's management UI.
On the host's **Auth** tab pick **Single sign-on (SSO)** and, optionally, fill in
the **Allowed users** / **Allowed groups** lists. Empty lists mean any
authenticated user is allowed; otherwise the identity must match one of them.

The proxy runs the OIDC flow itself at `/__proxy_auth` on the protected host and
keeps a Redis-backed session in a `__proxy_sso` cookie, so the app behind it
needs no changes.

**The IdP must allow the per-host callback.** Each protected host calls back to
`https://<that-host>/__proxy_auth/callback`, which is a different URL for every
host, all against the proxy's one OAuth client. Register a wildcard redirect URI
on that client — the SSO Manager supports `*` (one label) and `**` (any number):

```
https://**.example.com/__proxy_auth/callback
https://example.com/__proxy_auth/callback
```

theta-suite's bootstrap registers both automatically, and backfills them onto an
existing client. Without them, switching a host to SSO fails at the IdP with
`400 redirect_uri is not registered for this client`.

**Group suggestions come from the SSO.** The Allowed groups field autocompletes
from the SSO directory's groups when `sso.url` and `sso.apiToken` are set in the
proxy's config (theta-suite's bootstrap mints that read-only token). Without it
the field can only suggest the proxy's local groups, which for an SSO-gated host
are rarely the ones you want — the allow-list is matched against the `groups`
claim in the SSO's token, so only SSO groups can ever match.

## Load Balancing

If you have multiple servers running the same application, you can load balance traffic across them. When editing a host, you can specify **Additional Targets** (one `IP:port` per line). The proxy will automatically distribute incoming requests across your primary target and all additional targets using a round-robin strategy, providing simple high availability and load distribution without extra configuration.

## Want more detail?

This page skips the system-internals (Redis, OpenResty, the lookup service)
and the exact install steps. For those, see
[Architecture](architecture.html) and [Installation](installation.html).

[← Back to Home](index.html)
