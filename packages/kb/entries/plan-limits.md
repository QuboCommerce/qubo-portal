---
id: plan-limits
title: How organisations and sites are counted
audience: public
kind: policy
legal: true
updated: 2026-10-04
summary: Sites are a shared pool across your organisations; going over the plan locks editing, never the live site.
tags: [limit, limits, quota, organisation, organization, sites, pool, lock, locked, upgrade]
---
An **organisation** is one legal entity (one company number). A **site** is one website or shop inside it.

Your plan gives you a number of organisations and a pool of sites. The pool is shared:
on {{plans.growth.name}} ({{plans.growth.orgs}} organisations, {{plans.growth.sites}} sites) you can run all
{{plans.growth.sites}} sites in one organisation, or split them 3 + 1 or 2 + 2. Empty organisations are allowed.

**Freeing a site:** delete the site. Nothing else returns a slot.

**Over the limit** (for example after a downgrade or an expired licence): the oldest organisations
and sites stay editable; newer ones are locked in the back office. Locked sites **stay online**,
keep taking orders and keep all their data. Upgrading unlocks them immediately.

On a self-hosted server, these limits arrive in a signed licence that is renewed every
{{licence.heartbeat}}. If the server can't reach Qubo, the licence stays valid for {{licence.validity}}
plus {{licence.grace}} of grace, then falls back to {{plans.free.name}}. It never switches the site off.
