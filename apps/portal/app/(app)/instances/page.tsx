import Link from "next/link";
import { activeOrg, canManage, overview, portalPublicUrl } from "@/lib/org";
import { ago, instanceState, limit } from "@/lib/format";
import { AddInstance } from "@/components/add-instance";
import { RevokeInstance } from "@/components/revoke-instance";

export const metadata = { title: "Instances" };

export default async function Instances() {
  const { active } = await activeOrg();
  const data = await overview(active.id);
  if (!data) return <p className="text-sm text-red-600">Could not load instances.</p>;
  const live = data.instances.filter((i) => !i.revokedAt);
  const revoked = data.instances.filter((i) => i.revokedAt);
  const max = data.plan.limits.instances;
  const manage = canManage(data.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Instances</h1>
          <p className="text-sm text-neutral-500">{live.length} of {limit(max)} on {data.plan.name}. Each self-hosted Qubo server is one instance.</p>
        </div>
      </div>

      {manage && <AddInstance orgId={active.id} portalUrl={portalPublicUrl()} atLimit={max !== null && live.length >= max} />}

      {live.length ? (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {live.map((i) => {
            const st = instanceState(i);
            return (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <Link href={`/instances/${i.id}`} className="min-w-0 flex-1">
                  <p className="font-medium hover:text-accent">{i.name}</p>
                  <p className="truncate text-neutral-500">v{i.appVersion} · {i.channel}{i.lastUsage ? ` · ${i.lastUsage.sites} sites · ${i.lastUsage.seats} seats` : ""}</p>
                </Link>
                <span className={`shrink-0 ${st.tone}`}>{st.label} · {ago(i.lastSeenAt)}</span>
                {manage && <RevokeInstance orgId={active.id} instanceId={i.id} name={i.name} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No linked instances.</p>
      )}

      {revoked.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-500">{revoked.length} revoked</summary>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {revoked.map((i) => (
              <li key={i.id} className="flex justify-between px-4 py-2 text-neutral-500">
                <Link href={`/instances/${i.id}`}>{i.name}</Link>
                <span>revoked {ago(i.revokedAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
