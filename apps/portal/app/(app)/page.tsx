import Link from "next/link";
import { getSession, listOrgs } from "@/lib/server-api";
import { overview } from "@/lib/org";
import { ago, day, instanceState, limit } from "@/lib/format";
import { CreateOrg } from "@/components/create-org";

export default async function Dashboard() {
  const [session, orgs] = await Promise.all([getSession(), listOrgs()]);
  if (!orgs.length) {
    return (
      <section className="max-w-lg">
        <h1 className="text-xl font-semibold">Create your organisation</h1>
        <p className="mt-1 mb-4 text-sm text-neutral-500">The business you bill and license Qubo for. You can join or create more later.</p>
        <CreateOrg />
        <ol className="mt-8 space-y-3 text-sm">
          {[
            ["Create your organisation", "Plans and billing are per organisation."],
            ["Link your Qubo instances", "Instances → Add instance gives a one-time token you paste in Qubo Admin → Settings → Qubo Portal."],
            ["Pick a plan when you need more", "Free covers one site per instance. Growth unlocks more sites, seats and features."],
          ].map(([t, d], n) => (
            <li key={t} className="flex gap-3">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${n === 0 ? "bg-accent text-white" : "bg-neutral-200 text-neutral-600"}`}>{n + 1}</span>
              <span><span className="font-medium">{t}</span><br /><span className="text-neutral-500">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  const active = orgs.find((o) => o.id === session?.session.activeOrganizationId) ?? orgs[0];
  const data = await overview(active.id);
  if (!data) return <p className="text-sm text-red-600">Could not load this organisation.</p>;
  const live = data.instances.filter((i) => !i.revokedAt);
  const sites = live.reduce((n, i) => n + (i.lastUsage?.sites ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{active.name}</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Plan" value={data.plan.name} hint={data.billing.currentPeriodEnd ? `Renews ${day(data.billing.currentPeriodEnd)}` : data.plan.id === "free" ? "No subscription" : undefined} href="/billing" />
        <Stat label="Instances" value={`${live.length} / ${limit(data.plan.limits.instances)}`} href="/instances" />
        <Stat label="Sites" value={`${sites} / ${limit(data.plan.limits.sites)}`} hint={`Across up to ${limit(data.plan.limits.orgs)} ${data.plan.limits.orgs === 1 ? "organisation" : "organisations"} and all servers`} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Instances</h2>
          <Link href="/instances" className="text-sm text-accent">Manage</Link>
        </div>
        {live.length ? (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {live.slice(0, 5).map((i) => {
              const st = instanceState(i);
              return (
                <li key={i.id}>
                  <Link href={`/instances/${i.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50">
                    <span className="font-medium">{i.name}</span>
                    <span className={st.tone}>{st.label} · {ago(i.lastSeenAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            No instances linked yet. Qubo runs fine on its own; linking adds your plan&apos;s limits, update notices and fleet health.{" "}
            <Link href="/instances" className="font-medium text-accent">Link your first instance</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300">{body}</Link>
  ) : (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">{body}</div>
  );
}
