---
layout: default
title: DNS Providers
description: A plain-language guide to why theta42/proxy needs a DNS provider, and only for wildcard certificates.
---

# DNS Providers

This page explains, in plain language, what a "DNS provider" is for in this
app and when you actually need one. For setup steps, see
[Installation](installation.html).

## Do you need this at all?

**Only if you want a [wildcard host](concepts-hosts.html)** (something like
`*.example.com` covering every subdomain with one certificate). A normal,
single-name host doesn't need a DNS provider configured at all — skip this
page entirely if that's all you're setting up.

## Why a wildcard cert needs this extra step

To prove you actually own `example.com` before issuing a certificate that
covers *every* possible subdomain of it, Let's Encrypt needs to see a
specific, temporary DNS record appear on that domain — something only the
real owner of the domain could add. A normal single-host certificate
doesn't need this because it can prove ownership a simpler way (by
responding to a web request instead).

So: to get a wildcard certificate, this app needs to be able to add (and
later remove) that one temporary DNS record on your domain automatically,
which means it needs your domain registrar or DNS host's API credentials —
that's what registering a **DNS provider** here does.

## What you're actually giving it access to

A DNS provider entry only needs enough access to add/remove TXT records —
it's not given your registrar account's full login, and it can't do
anything to your domain besides that one narrow task (and, for some
providers, keeping a dynamic A record updated if you use that feature
separately). Check your specific provider's page in the
[Installation guide](installation.html) for exactly what kind of
credential to generate and how narrowly you can scope it.

## Want more detail?

For exact setup steps per provider (Cloudflare, DigitalOcean, Porkbun,
DuckDNS, etc.), see [Installation](installation.html).

[← Back to Home](index.html)
