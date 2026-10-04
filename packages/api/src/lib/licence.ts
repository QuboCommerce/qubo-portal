import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { instance, license } from "@qubo-portal/db/schema";
import { PLANS, type PlanId } from "@qubo-portal/plans";
import { LICENCE_GRACE_SECONDS, LICENCE_TTL_SECONDS, type LicenseClaims } from "@qubo/protocol";
import { allot } from "./allot";
import { signer } from "./keys";

export async function planOf(organizationId: string): Promise<PlanId> {
  const [row] = await db.select({ plan: license.plan, status: license.status }).from(license).where(eq(license.organizationId, organizationId));
  return row && row.status === "active" ? row.plan : "free";
}

/** Signed licence for one instance (JWS, EdDSA). Instances verify it against /.well-known/jwks.json. */
export async function mintLicence(instanceId: string, organizationId: string) {
  const plan = await planOf(organizationId);
  const def = PLANS[plan];
  const fleet = await db
    .select({ id: instance.id, usage: instance.lastUsage })
    .from(instance)
    .where(and(eq(instance.organizationId, organizationId), isNull(instance.revokedAt)))
    .orderBy(asc(instance.createdAt), asc(instance.id));
  const at = fleet.findIndex((i) => i.id === instanceId);
  const iat = Math.floor(Date.now() / 1000);
  const claims: Omit<LicenseClaims, "iat" | "exp"> = {
    iss: process.env.PORTAL_API_URL ?? process.env.PORTAL_URL ?? "qubo-portal",
    sub: instanceId,
    organizationId,
    plan,
    limits: allot(def.limits, fleet.slice(0, at < 0 ? fleet.length : at).map((i) => i.usage)),
    features: def.features,
    grace: LICENCE_GRACE_SECONDS,
  };
  const { sign } = await signer();
  return sign(claims, iat + LICENCE_TTL_SECONDS);
}
