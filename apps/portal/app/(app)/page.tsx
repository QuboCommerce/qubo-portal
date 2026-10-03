import { api, getSession, listOrgs } from "@/lib/server-api";
import { CreateOrg } from "@/components/create-org";
import { OrgSwitcher } from "@/components/org-switcher";
import { RegisterInstance } from "@/components/register-instance";

type Overview = {
  plan: { id: string; name: string; limits: Record<string, number | null> };
  role: string;
  instances: {
    id: string;
    name: string;
    appVersion: string;
    channel: string;
    lastSeenAt: string | null;
    lastHealth: Record<string, boolean> | null;
    revokedAt: string | null;
  }[];
};

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 129600 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

export default async function Dashboard() {
  const [session, orgs] = await Promise.all([getSession(), listOrgs()]);
  if (!orgs.length) {
    return (
      <section className="max-w-md">
        <h1 className="text-xl font-semibold">Create your organisation</h1>
        <p className="mt-1 mb-4 text-sm text-neutral-500">The business you bill and license Qubo for. You can join or create more later.</p>
        <CreateOrg />
      </section>
    );
  }
  const active = orgs.find((o) => o.id === session?.session.activeOrganizationId) ?? orgs[0];
  const { data } = await api<Overview>(`/v1/orgs/${active.id}/overview`);
  const canManage = data && ["owner", "admin"].includes(data.role);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{active.name}</h1>
          <p className="text-sm text-neutral-500">
            {data?.plan.name ?? "Free"} plan · instances {data?.instances.filter((i) => !i.revokedAt).length ?? 0}/{data?.plan.limits.instances ?? "∞"}
          </p>
        </div>
        <OrgSwitcher orgs={orgs} activeId={active.id} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Instances</h2>
          {canManage && <RegisterInstance orgId={active.id} portalApiUrl={process.env.PORTAL_API_URL ?? ""} />}
        </div>
        {data?.instances.length ? (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {data.instances.map((i) => {
              const healthy = i.lastHealth && Object.values(i.lastHealth).every(Boolean);
              return (
                <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{i.name} {i.revokedAt && <span className="text-red-600">(revoked)</span>}</p>
                    <p className="text-neutral-500">{i.id} · v{i.appVersion} · {i.channel}</p>
                  </div>
                  <span className={healthy ? "text-emerald-600" : "text-neutral-500"}>{i.lastSeenAt ? (healthy ? "healthy" : "degraded") : "waiting"} · {ago(i.lastSeenAt)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No instances yet. Register your first Qubo install to receive its licence and updates.</p>
        )}
      </section>
    </div>
  );
}
