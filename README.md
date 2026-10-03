# qubo-portal

The Qubo control plane and marketing site. Private.

| App | Prod host | Dev host (slot) | What |
| --- | --- | --- | --- |
| `apps/marketing` | `qubo.by-ali.dev` | `www.dev.by-ali.dev` (2) | Static marketing + pricing |
| `apps/portal` | `portal.qubo.by-ali.dev` | `dev.by-ali.dev` (1) | Accounts, organisations, instances, licences |
| `packages/api` | `api.portal.qubo.by-ali.dev` | `api.dev.by-ali.dev` (3) | Elysia/Bun: Better Auth, fleet protocol, JWKS |
| Supabase Studio | `db.portal.qubo.by-ali.dev` (auth only) | `db.dev.by-ali.dev` | |

No hostname is hardcoded: everything comes from env (`.env.example`). Qubo instances
only know `PORTAL_URL`, so moving the portal to a product domain is a config change.

## Packages

- `@qubo/protocol` — wire contract with Qubo instances. **Vendored** from
  `qubo-stack/packages/protocol`; edit it there, then `pnpm protocol:sync`.
  Replace with the published package once GitHub Packages publishing exists.
- `@qubo-portal/plans` — pricing catalogue; marketing renders it, the API signs its limits into licences.
- `@qubo-portal/db` — Drizzle schema: Better Auth (+ organization plugin), `license`,
  `registration_token`, `instance`, `heartbeat`, `release`.

## Instance protocol (v1)

1. Owner clicks **Register instance** in the portal → one-time token (1 h).
2. On the server: `qubo register <token>` generates an Ed25519 keypair and calls
   `POST /v1/instances/register` → `instanceId`.
3. Every 5 min: `POST /v1/heartbeat`, signed (`x-qubo-instance`, `x-qubo-timestamp`,
   `x-qubo-signature`; see `signingPayload` in `@qubo/protocol`). Response: a licence JWT
   (EdDSA, 30 d + 7 d grace) verifiable against `GET /.well-known/jwks.json`, plus the newest
   release on the instance's channel when it is behind.
4. `GET /v1/releases/latest?channel=stable|beta|alpha`.

## Dev

```sh
cp .env.example .env          # then point DATABASE_URL at qubo_portal
pnpm install
pnpm db:migrate
pnpm qd up                    # api, portal, marketing in screen session "qubo-portal"
pnpm smoke                    # end-to-end: signup → org → register → signed heartbeat → licence
```

The dev hosts are shared by every project on the box (slots 1–3, ports `<digit>0<slot>0`),
so only one project runs at a time: `pnpm qd down` in the other repo first.

## Prod

Coolify on the rented VPS: three services from this repo (`apps/marketing`, `apps/portal`,
`packages/api`), plus a Supabase. Set every variable in `.env.example`; generate
`PORTAL_SIGNING_KEYS` once with `pnpm keys:generate` and keep it in Coolify secrets only.
