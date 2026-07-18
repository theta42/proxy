---
layout: default
title: Users, Groups & Permissions
description: A plain-language guide to local admin accounts, groups, and the domain-scoped permission model in theta42/proxy.
---

# Users, Groups & Permissions

This page explains, in plain language, who can manage what in this app. For
the deeper system-design detail, see [Architecture](architecture.html).

## Two different ways to log in

Most people who use apps you've proxied through this app never see this
app's own login at all — they use whatever authentication you set up on
the *individual host* (basic auth, or single sign-on through your SSO
Manager). This page is about a different, smaller group: the people who
manage the proxy itself — adding hosts, registering DNS providers, and so
on.

There are two ways someone gets into the proxy's own management UI:

- **A local account**, created on the **Users** page — a username and
  password specific to this app.
- **Single sign-on**, if you've connected this proxy to an SSO Manager (or
  another OIDC provider) — the same login your other connected apps use.

Either way, once logged in, what they're actually *allowed to do* here is
controlled by permissions, described below.

## Groups

A **group** here is just a named list of local usernames, used to grant
the same permission to several people at once instead of one at a time.
If you're using SSO instead of local accounts, group membership normally
comes from your identity provider instead — local groups exist mainly for
the local-account case.

## Permissions: scope + role

Each **permission** entry grants one subject (a user or a group) one
**role**, at one **scope** — the two are independent choices:

**Scope** — *where* the role applies:

- **Domain** — only hosts under one specific domain (e.g. someone can
  manage everything under `example.com`, but can't see or touch a
  completely different domain you also proxy).
- **Global** — everywhere, across every domain this proxy manages.

**Role** — *what* they can do within that scope:

- **Viewer** — read-only. Can see hosts and their settings, but not
  change anything.
- **Manager** — full control over hosts (create, edit, delete) within
  that scope.
- **Admin** — same host control as Manager, **plus**, but *only when
  granted at Global scope*, the ability to manage other people's
  permissions, DNS providers, and local user accounts. An Admin role
  granted at Domain scope instead of Global behaves exactly like Manager
  for that one domain — it does not unlock those extra admin-only pages.

In practice: give someone **Manager** on just the domain(s) they're
responsible for to delegate day-to-day host management without handing
them the keys to everything. Reserve **Global Admin** for people who
should be able to change anything, anywhere, including who else has
access.

## Want more detail?

This page doesn't cover the exact permission-checking implementation or
how SSO group membership maps into this system internally — for that, see
[Architecture](architecture.html).

[← Back to Home](index.html)
