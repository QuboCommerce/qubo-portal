import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { wellKnown } from "./routes/well-known";
import { fleet } from "./routes/fleet";
import { orgs } from "./routes/orgs";
import { releases } from "./routes/releases";

/**
 * Portal API. Unversioned: /health, /.well-known/*, /api/auth/* (Better Auth,
 * proxied same-origin by the portal app). Everything else lives under /v1.
 */
export const app = new Elysia()
  .get("/health", () => ({ ok: true }))
  .mount(auth.handler)
  .use(wellKnown)
  .group("/v1", (v1) => v1.use(fleet).use(releases).use(orgs));

export type App = typeof app;
