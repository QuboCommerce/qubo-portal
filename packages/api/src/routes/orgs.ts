import { Elysia } from "elysia";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { heartbeat, instance, member, registrationToken } from "@qubo-portal/db/schema";
import { PLANS, type PlanId } from "@qubo-portal/plans";
import { billingConfigured, checkoutUrl, customerPortalUrl, devPlanOverride, licenseRow, setLicense } from "../lib/billing";
import { sessionOf } from "../lib/auth";
import { newId, randomToken, sha256Hex } from "../lib/crypto";
import { planOf } from "../lib/licence";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const LICENCE_TTL_MS = 30 * 24 * 3600 * 1000;
const GRACE_MS = 7 * 24 * 3600 * 1000;
const portalUrl = () => (process.env.PORTAL_URL ?? process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
const isManager = (role: string) => ["owner", "admin"].includes(role);

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
    const lic = await licenseRow(params.orgId);
    return {
      plan: PLANS[plan],
      role: m.role,
      instances,
      billing: {
        configured: billingConfigured(),
        devOverride: devPlanOverride(),
        status: lic?.status ?? null,
        currentPeriodEnd: lic?.currentPeriodEnd ?? null,
        hasCustomer: Boolean(lic?.stripeCustomerId),
      },
    };
  })
  .get("/instances/:instanceId", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    const [ins] = await db
      .select()
      .from(instance)
      .where(and(eq(instance.id, params.instanceId), eq(instance.organizationId, params.orgId)));
    if (!ins) return (set.status = 404), { error: "not_found" };
    const beats = await db
      .select({ id: heartbeat.id, appVersion: heartbeat.appVersion, health: heartbeat.health, usage: heartbeat.usage, receivedAt: heartbeat.receivedAt })
      .from(heartbeat)
      .where(eq(heartbeat.instanceId, ins.id))
      .orderBy(desc(heartbeat.receivedAt))
      .limit(50);
    const plan = PLANS[await planOf(params.orgId)];
    // A licence is minted on registration and on every heartbeat; the newest one is what the instance holds.
    const issuedAt = ins.lastSeenAt ?? ins.createdAt;
    const { publicKey, ...rest } = ins;
    return {
      role: m.role,
      instance: { ...rest, publicKeyFingerprint: `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}` },
      licence: ins.revokedAt
        ? null
        : { plan: plan.id, planName: plan.name, limits: plan.limits, issuedAt, expiresAt: new Date(issuedAt.getTime() + LICENCE_TTL_MS), graceEndsAt: new Date(issuedAt.getTime() + LICENCE_TTL_MS + GRACE_MS) },
      heartbeats: beats,
    };
  })
  .post("/registration-tokens", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!isManager(m.role)) return (set.status = 403), { error: "forbidden" };
    const limit = PLANS[await planOf(params.orgId)].limits.instances;
    const [{ n }] = await db.select({ n: count() }).from(instance).where(and(eq(instance.organizationId, params.orgId), isNull(instance.revokedAt)));
    if (limit !== null && n >= limit) return (set.status = 402), { error: "license.instances_exceeded", limit };
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
  })
  .post("/billing/checkout", async ({ params, request, body, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!isManager(m.role)) return (set.status = 403), { error: "forbidden" };
    const plan = (body as { plan?: string } | null)?.plan as PlanId | undefined;
    if (!plan || !(plan in PLANS) || PLANS[plan].priceCents === null) return (set.status = 400), { error: "invalid_plan" };
    if (!billingConfigured()) return (set.status = 503), { error: "billing_not_configured" };
    const lic = await licenseRow(params.orgId);
    // Existing subscribers change plans in the Stripe customer portal (proration handled there).
    if (lic?.stripeSubscriptionId && lic.status === "active") return { url: await customerPortalUrl(params.orgId, `${portalUrl()}/billing`) };
    return { url: await checkoutUrl({ organizationId: params.orgId, plan, email: m.user.email, returnUrl: `${portalUrl()}/billing` }) };
  })
  .post("/billing/portal", async ({ params, request, set }) => {
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!isManager(m.role)) return (set.status = 403), { error: "forbidden" };
    if (!billingConfigured()) return (set.status = 503), { error: "billing_not_configured" };
    try {
      return { url: await customerPortalUrl(params.orgId, `${portalUrl()}/billing`) };
    } catch {
      return (set.status = 409), { error: "no_customer" };
    }
  })
  .post("/billing/dev-plan", async ({ params, request, body, set }) => {
    if (!devPlanOverride()) return (set.status = 404), { error: "not_found" };
    const m = await membership(request.headers, params.orgId);
    if ("error" in m) return (set.status = m.error), { error: "not_found" };
    if (!isManager(m.role)) return (set.status = 403), { error: "forbidden" };
    const plan = (body as { plan?: string } | null)?.plan as PlanId | undefined;
    if (!plan || !(plan in PLANS)) return (set.status = 400), { error: "invalid_plan" };
    await setLicense(params.orgId, { plan, status: "active" });
    return { ok: true, plan };
  });
