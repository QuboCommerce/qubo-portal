export const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 129600 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
export const day = (iso: string | Date | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const limit = (n: number | null | undefined) => (n === null || n === undefined ? "Unlimited" : String(n));

/** waiting = never heard from; stale = no heartbeat in 13 h (two missed 6 h beats). */
export function instanceState(i: { lastSeenAt: string | null; lastHealth: Record<string, boolean> | null; revokedAt: string | null }) {
  if (i.revokedAt) return { label: "revoked", tone: "text-red-600" };
  if (!i.lastSeenAt) return { label: "waiting for first heartbeat", tone: "text-neutral-500" };
  if (Date.now() - new Date(i.lastSeenAt).getTime() > 13 * 3600 * 1000) return { label: "offline", tone: "text-amber-600" };
  const healthy = i.lastHealth && Object.values(i.lastHealth).every(Boolean);
  return healthy ? { label: "healthy", tone: "text-emerald-600" } : { label: "degraded", tone: "text-amber-600" };
}
