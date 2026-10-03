import { Elysia } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { instance, member, registrationToken } from "@qubo-portal/db/schema";
import { PLANS } from "@qubo-portal/plans";
import { sessionOf } from "../lib/auth";
import { newId, randomToken, sha256Hex } from "../lib/crypto";
import { planOf } from "../lib/licence";

const TOKEN_TTL_MS = 60 * 60 * 1000;

async function membership(headers: Headers, organizationId: string) {
  const s = await sessionOf(headers);
  if (!s) return { error: 401 as const };
  const [m] = await db.select().from(member).where(and(eq(member.organizationId, organizationId), eq(member.userId, s.user.id)));
  if (!m) return { error: 404 as const };
  return { user: s.user, role: m.role };
}

/** Portal UI endpoints (session cookie, proxied same-origin by the portal app). */
export const orgs = new Elysia({ prefix: "/orgs/:orgId" })
  .get("/overview", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    const plan = await planOf(params.orgId);
    const instances = await db
      .select({
        id: instance.id,
        name: instance.name,
        appVersion: instance.appVersion,
        channel: instance.channel,
        lastSeenAt: instance.lastSeenAt,
        lastHealth: instance.lastHealth,
        lastUsage: instance.lastUsage,
        revokedAt: instance.revokedAt,
        createdAt: instance.createdAt,
      })
      .from(instance)
      .where(eq(instance.organizationId, params.orgId))
      .orderBy(desc(instance.createdAt));
    return { plan: PLANS[plan], role: m.role, instances };
  })
  .post("/registration-tokens", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!["owner", "admin"].includes(m.role)) return (set.status = 403), { error: "forbidden" };
    const token = randomToken("qrt");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await db.insert(registrationToken).values({
      id: newId("rt"),
      tokenHash: await sha256Hex(token),
      organizationId: params.orgId,
      createdBy: m.user.id,
      expiresAt,
    });
    set.status = 201;
    return { token, expiresAt };
  })
  .post("/instances/:instanceId/revoke", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!["owner", "admin"].includes(m.role)) return (set.status = 403), { error: "forbidden" };
    await db.update(instance).set({ revokedAt: new Date() }).where(and(eq(instance.id, params.instanceId), eq(instance.organizationId, params.orgId)));
    return { ok: true };
  });
