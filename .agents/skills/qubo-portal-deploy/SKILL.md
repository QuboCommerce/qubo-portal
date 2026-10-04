---
name: qubo-portal-deploy
description: Building, running and relocating the Qubo portal in production (Dockerfiles, docker-compose, env, edge routing, Coolify, migration between machines). Use for any deploy, image or hosting question.
---

# Portal deploy

Full runbook: `docs/DEPLOY.md`. Summary for agents:

- Three images (`packages/api/Dockerfile`, `apps/portal/Dockerfile`, `apps/marketing/Dockerfile`)
  plus Postgres in `docker-compose.yml`. Deps install with `--ignore-scripts` because the
  postinstall only symlinks the dev `.env`.
- The API container runs `packages/db/src/migrate.ts` before listening.
- No proxy, no hostnames: services publish on `127.0.0.1:3340/3341/3342`; the machine's edge
  (Traefik next to a Qubo instance, or Coolify's proxy) routes hosts to them.
- Required env: `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `PORTAL_URL`, `PORTAL_API_URL`,
  `SITE_URL`, `PORTAL_SIGNING_KEYS` (`pnpm keys:generate`). Keep the signing keys across
  moves or issued licences stop verifying.
- Verify a build the way it was verified when added:
  `docker compose -p t --env-file <tmp env> up -d --build`, then `curl 127.0.0.1:3340/health`,
  `curl 127.0.0.1:3352/robots.txt` must show `SITE_URL`, and the marketing page must link to
  `PORTAL_URL`. Tear down with `down -v`.
- Dev and prod on one machine never collide: dev uses `qd` slots 4010/4020/4030, prod the
  334x ports.
