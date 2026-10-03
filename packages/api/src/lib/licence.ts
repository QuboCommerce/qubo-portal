import { eq } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { license } from "@qubo-portal/db/schema";
import { PLANS, type PlanId } from "@qubo-portal/plans";
import type { LicenseClaims } from "@qubo/protocol";
import { signer } from "./keys";

const TTL_SECONDS = 30 * 24 * 3600;
const GRACE_SECONDS = 7 * 24 * 3600;

export async function planOf(organizationId: string): Promise<PlanId> {
  const [row] = await db.select({ plan: license.plan, status: license.status }).from(license).where(eq(license.organizationId, organizationId));
  return row && row.status === "active" ? row.plan : "free";
}

/** Signed licence for one instance (JWS, EdDSA). Instances verify it against /.well-known/jwks.json. */
export async function mintLicence(instanceId: string, organizationId: string) {
  const plan = await planOf(organizationId);
  const def = PLANS[plan];
  const iat = Math.floor(Date.now() / 1000);
  const claims: Omit<LicenseClaims, "iat" | "exp"> = {
    iss: process.env.PORTAL_API_URL ?? process.env.PORTAL_URL ?? "qubo-portal",
    sub: instanceId,
    organizationId,
    plan,
    limits: def.limits,
    features: def.features,
    grace: GRACE_SECONDS,
  };
  const { sign } = await signer();
  return sign(claims, iat + TTL_SECONDS);
}
