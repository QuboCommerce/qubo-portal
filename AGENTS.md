# Qubo portal (qubo-portal)

The control plane for Qubo: `apps/marketing` (public site), `apps/portal` (accounts,
organisations, instances, licences) and `packages/api` (Elysia on Bun: Better Auth, fleet
protocol, JWKS). The product that customers run lives in `qubo-stack`; instances talk to
this repo only through `@qubo/protocol` and `PORTAL_URL`.

Read `README.md` for the instance protocol and `docs/DEPLOY.md` before touching anything
that runs in production.

## Hard rules

- Same naming as qubo-stack: `@qubo-portal/*` packages here, `@qubo/*` for shared ones,
  env `PORTAL_*` / `QUBO_*`, no legacy names anywhere.
- No hostname in code or images. Public URLs are env read at request time; never
  `NEXT_PUBLIC_*` for URLs. Routes that emit URLs are `force-dynamic`.
- The portal is a single point of failure today. Nothing an instance does at request time
  may depend on it; design every instance-facing endpoint for retry and cached results.
- `@qubo/protocol` is vendored from qubo-stack: edit it there, then `pnpm protocol:sync`.
- Branch from `staging`, verify, changeset not required yet (pre-release), merge `--no-ff`.
  Governance mirrors qubo-stack (`scripts/check-branch-governance.mjs`).
- Gates: `pnpm typecheck` green, `pnpm smoke` against the running dev API when the protocol
  or auth changed, and `docker compose build` when a Dockerfile or dependency changed.

## Skills (`.agents/skills/`)

| Skill | Use when |
| --- | --- |
| `qubo-portal-deploy` | building images, running compose, moving the portal between machines |
| `qubo-portal-kb` | prices, plan limits, policies, knowledgebase entries, support answers |

The dev runner, naming, database and branch skills are identical to qubo-stack's; read them
from `../../Mostapha/qubo-stack/.agents/skills/` when that checkout exists.
