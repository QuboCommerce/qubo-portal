import "server-only";
import { redirect } from "next/navigation";
import type { Limits, PlanDef } from "@qubo-portal/plans";
import { api, getSession, listOrgs } from "./server-api";

export type InstanceSummary = {
  id: string;
  name: string;
  appVersion: string;
  channel: string;
  lastSeenAt: string | null;
  lastHealth: { db: boolean; api: boolean; storefront: boolean } | null;
  lastUsage: { orgs: number; sites: number; seats: number; storageMB: number } | null;
  revokedAt: string | null;
  createdAt: string;
};

export type Overview = {
  plan: PlanDef;
  role: string;
  instances: InstanceSummary[];
  billing: { configured: boolean; devOverride: boolean; status: string | null; currentPeriodEnd: string | null; hasCustomer: boolean };
};

export type InstanceDetail = {
  role: string;
  instance: InstanceSummary & { protocolVersion: number; publicKeyFingerprint: string };
  licence: { plan: string; planName: string; limits: Limits; issuedAt: string; expiresAt: string; graceEndsAt: string } | null;
  heartbeats: { id: string; appVersion: string; health: Record<string, boolean>; usage: Record<string, number>; receivedAt: string }[];
};

/** Active organisation for the signed-in user; sends org-less users to onboarding. */
export async function activeOrg() {
  const [session, orgs] = await Promise.all([getSession(), listOrgs()]);
  if (!orgs.length) redirect("/");
  const active = orgs.find((o) => o.id === session?.session.activeOrganizationId) ?? orgs[0];
  return { session, orgs, active };
}

export async function overview(orgId: string) {
  const { data } = await api<Overview>(`/v1/orgs/${orgId}/overview`);
  return data;
}

export const canManage = (role?: string) => role === "owner" || role === "admin";
export const portalPublicUrl = () => (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
