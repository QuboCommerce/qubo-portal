# Deploying the portal

The portal is three containers plus Postgres (`docker-compose.yml`). It ships with
**no edge proxy and no hostnames**: services publish on loopback ports and the machine's
existing edge routes hosts to them. That is what makes it movable.

| Service | Container port | Host port (default) | Public host |
| --- | --- | --- | --- |
| `portal-api` | 3340 | `127.0.0.1:3340` | `api.portal.qubo.by-ali.dev` |
| `portal` | 3000 | `127.0.0.1:3341` | `portal.qubo.by-ali.dev` |
| `marketing` | 3000 | `127.0.0.1:3342` | `qubo.by-ali.dev` |
| `portal-postgres` | 5432 | not published | |

Change host ports with `PORTAL_API_PORT`, `PORTAL_PORT`, `MARKETING_PORT`; set `PORTAL_BIND=0.0.0.0`
only when the proxy runs on another machine.

## Where it can live

**Next to a Qubo instance (today: Mostapha's OVH VPS).** The machine's Traefik edge already owns
80/443 and discovers containers through Docker labels. Use the adapter override, which joins the
edge network and declares the routers (no host ports):

```sh
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

with `EDGE_NETWORK`, `MARKETING_HOST`, `PORTAL_HOST`, `PORTAL_API_HOST` in `.env`. If the edge
uses a file provider instead, skip the override and point three routers at the loopback ports.
The portal keeps its own Postgres container and volume, so it never touches instance data.

**Coolify.** Create a *Docker Compose* resource from this repo, paste `.env` into the resource's
environment, and attach the three domains to `portal-api`, `portal` and `marketing` (Coolify's
proxy handles TLS; leave `PORTAL_BIND` unset). Nothing in the repo is Coolify-specific.

**The dev box (dev and prod on one machine).** Prod runs from compose on the 334x ports; dev runs
through `qd` on the 40x0 slots. They never share ports, databases or env files. The edge routes
`*.qubo.dev.by-ali.dev` to the portal slots (devDigit 5, runs alongside qubo-stack) and the production hosts to the compose ports.

## First deploy

```sh
git clone git@github.com:aliaddas/qubo-portal.git && cd qubo-portal
cp .env.example .env            # fill: POSTGRES_PASSWORD, BETTER_AUTH_SECRET, PORTAL_URL,
                                #       PORTAL_API_URL, SITE_URL, PORTAL_SIGNING_KEYS
pnpm keys:generate              # prints PORTAL_SIGNING_KEYS; paste it into .env
docker compose up -d --build    # the API applies migrations before it listens
curl -s 127.0.0.1:3340/health
```

Then add the edge routes and DNS. Nothing else reads the hostnames.

## Redeploy

```sh
scripts/deploy.sh            # resets to origin/main, rebuilds, restarts, prunes old images
```

The script adds `docker-compose.traefik.yml` automatically when `.env` sets `EDGE_NETWORK`.

## Current production

Mostapha's OVH VPS (`141.227.165.96`, user `qubo`), checkout at `/home/qubo/qubo-portal`,
behind Coolify's Traefik (`EDGE_NETWORK=coolify`, `EDGE_ENTRYPOINT_HTTPS=https`,
`EDGE_ENTRYPOINT_HTTP=http`). Coolify UI: `ssh -N -L 8000:127.0.0.1:8000 qubo@<ip>` → http://localhost:8000.

| Host | Service |
| --- | --- |
| `qubo.by-ali.dev` | marketing |
| `portal.qubo.by-ali.dev` | portal |
| `api.portal.qubo.by-ali.dev` | portal-api |

Deploy key: read-only `qubo@vps-04d736b1` on the GitHub repo. `tailg-app` shares the same edge (compose at `/home/dev/react/tailg`, old `wooster-traefik` kept under profile `legacy-edge`). Moving the portal
elsewhere = copy `.env` + a `pg_dump`, repoint DNS; instances only know `PORTAL_URL`.

Migrations run on API start. They are forward-only; back up first (below) for anything
that drops or rewrites data.

## Billing (Stripe)

Plans live in `packages/plans` (single source for marketing, licences and Stripe). Billing unit =
organisation. Without Stripe keys the portal works and `/billing` shows plans read-only.

1. Stripe dashboard (test mode first): copy the secret key into `.env` as `STRIPE_SECRET_KEY`.
2. `STRIPE_SECRET_KEY=… pnpm stripe:setup` — creates one product per paid plan and a monthly EUR
   price with lookup key `qubo_<plan>_monthly`. Idempotent; a price change moves the lookup key to a
   new price (existing subscribers keep theirs until migrated).
3. Developers → Webhooks → add endpoint `https://api.portal.qubo.by-ali.dev/v1/stripe/webhook`
   with events `checkout.session.completed`, `customer.subscription.created`, `.updated`,
   `.deleted`, `.paused`, `.resumed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Settings → Billing → Customer portal: enable invoices, payment method updates, cancellation
   and plan switching between the Qubo products.
5. `docker compose up -d portal-api` to pick up the env.

Mapping: `active`/`trialing`/`past_due` → plan from the price lookup key; anything terminal → Free.
Instances get the new plan on their next heartbeat (≤ 6 h, or "Refresh now" in the admin).
Local webhook testing: `stripe listen --forward-to https://api.qubo.dev.by-ali.dev/v1/stripe/webhook`.

## Backup and restore

```sh
docker compose exec -T portal-postgres pg_dump -U qubo_portal qubo_portal | gzip > portal-$(date +%F).sql.gz
gunzip -c portal-YYYY-MM-DD.sql.gz | docker compose exec -T portal-postgres psql -U qubo_portal qubo_portal
```

## Moving the portal to another machine

Instances only know `PORTAL_URL` and verify licences against the JWKS the portal serves, so a move
is a DNS change as far as they are concerned.

1. On the new machine: first-deploy steps above with the **same** `.env` (same
   `PORTAL_SIGNING_KEYS`, or existing licences stop verifying).
2. Restore the latest dump.
3. Lower the DNS TTL ahead of time, then repoint `qubo`, `portal.qubo`, `api.portal.qubo`.
4. Instances keep working during the switch: a licence is valid 30 days plus a 7 day grace
   window, and heartbeats simply retry.
5. `docker compose down` on the old machine once logs show instances heartbeating to the new one.

## Rules this layout depends on

- No hostname in code or images. Public URLs are env, read at request time (`SITE_URL`,
  `PORTAL_URL`, `PORTAL_API_URL`). Never use `NEXT_PUBLIC_*` for URLs: it bakes the domain
  into the build. Routes that emit URLs are `force-dynamic` for the same reason.
- Instances must degrade gracefully when the portal is unreachable (cached licence, grace
  window, retrying heartbeat). The portal is a single machine today; nothing on an instance
  may block on it at request time.
- Secrets live in `.env` on the host (or the Coolify environment), never in the repo.
