import type { Limits } from "@qubo-portal/plans";

export type Usage = { orgs: number; sites: number } | null;

/**
 * Plan orgs/sites are pooled per account, but each instance enforces its own
 * licence. So each instance is signed what's left after the instances linked
 * before it (by their last heartbeat): the oldest server is never squeezed and
 * a newer one can't double the pool. Other limits are per instance as-is.
 */
export function allot(limits: Limits, olderUsage: Usage[]): Limits {
  const left = (limit: number | null, key: "orgs" | "sites") =>
    limit === null ? null : Math.max(0, limit - olderUsage.reduce((sum, u) => sum + (u?.[key] ?? 0), 0));
  return { ...limits, orgs: left(limits.orgs, "orgs"), sites: left(limits.sites, "sites") };
}
