import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/server-api";
import { activeOrg, canManage, type InstanceDetail } from "@/lib/org";
import { ago, day, instanceState, limit } from "@/lib/format";
import { RevokeInstance } from "@/components/revoke-instance";

export default async function InstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await activeOrg();
  const { status, data } = await api<InstanceDetail>(`/v1/orgs/${active.id}/instances/${id}`);
  if (status === 404 || !data) notFound();
  const { instance: i, licence, heartbeats } = data;
  const st = instanceState(i);
  const now = Date.now();
  const licenceState = !licence
    ? { label: "No licence (revoked)", tone: "text-red-600" }
    : now < new Date(licence.expiresAt).getTime()
      ? { label: `Valid until ${day(licence.expiresAt)}`, tone: "text-emerald-600" }
      : now < new Date(licence.graceEndsAt).getTime()
        ? { label: `Expired, grace until ${day(licence.graceEndsAt)}`, tone: "text-amber-600" }
        : { label: "Expired; instance runs on Free limits", tone: "text-amber-600" };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/instances" className="text-sm text-neutral-500 hover:text-ink">← Instances</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{i.name}</h1>
            <p className={`text-sm ${st.tone}`}>{st.label} · last heartbeat {ago(i.lastSeenAt)}</p>
          </div>
          {canManage(data.role) && !i.revokedAt && <RevokeInstance orgId={active.id} instanceId={i.id} name={i.name} />}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Licence">
          <Row k="Status"><span className={licenceState.tone}>{licenceState.label}</span></Row>
          {licence && (
            <>
              <Row k="Plan">{licence.planName}</Row>
              <Row k="Last issued">{day(licence.issuedAt)}</Row>
              <Row k="Sites per organisation">{limit(licence.limits.sitesPerOrg)}</Row>
              <Row k="Staff seats">{limit(licence.limits.seats)}</Row>
            </>
          )}
          <p className="pt-2 text-xs text-neutral-500">Renewed on every heartbeat (every 6 h). Valid 30 days, then 7 days of grace. An instance never locks; it falls back to Free.</p>
        </Card>
        <Card title="Instance">
          <Row k="ID"><code className="text-xs">{i.id}</code></Row>
          <Row k="Version">v{i.appVersion} · {i.channel}</Row>
          <Row k="Protocol">v{i.protocolVersion}</Row>
          <Row k="Signing key"><code className="text-xs">{i.publicKeyFingerprint}</code></Row>
          <Row k="Linked">{day(i.createdAt)}</Row>
          {i.lastHealth && (
            <Row k="Health">
              {Object.entries(i.lastHealth).map(([k, ok]) => <span key={k} className={`ml-2 ${ok ? "text-emerald-600" : "text-red-600"}`}>{k} {ok ? "✓" : "✗"}</span>)}
            </Row>
          )}
          {i.lastUsage && <Row k="Usage">{i.lastUsage.orgs} orgs · {i.lastUsage.sites} sites · {i.lastUsage.seats} seats · {i.lastUsage.storageMB} MB</Row>}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Heartbeats</h2>
        {heartbeats.length ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr><th className="px-4 py-2 font-medium">Received</th><th className="px-4 py-2 font-medium">Version</th><th className="px-4 py-2 font-medium">Health</th><th className="px-4 py-2 font-medium">Sites</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {heartbeats.map((h) => {
                  const ok = Object.values(h.health).every(Boolean);
                  return (
                    <tr key={h.id}>
                      <td className="px-4 py-2">{new Date(h.receivedAt).toLocaleString("en-GB")}</td>
                      <td className="px-4 py-2">v{h.appVersion}</td>
                      <td className={`px-4 py-2 ${ok ? "text-emerald-600" : "text-amber-600"}`}>{ok ? "healthy" : Object.entries(h.health).filter(([, v]) => !v).map(([k]) => k).join(", ") + " down"}</td>
                      <td className="px-4 py-2">{h.usage.sites ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No heartbeats yet.</p>
        )}
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
