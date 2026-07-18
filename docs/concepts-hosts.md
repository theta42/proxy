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

## Want more detail?

This page skips the system-internals (Redis, OpenResty, the lookup service)
and the exact install steps. For those, see
[Architecture](architecture.html) and [Installation](installation.html).

[← Back to Home](index.html)
