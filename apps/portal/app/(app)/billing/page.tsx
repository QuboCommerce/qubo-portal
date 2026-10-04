import { PLANS, PLAN_ORDER, formatPrice } from "@qubo-portal/plans";
import { activeOrg, canManage, overview } from "@/lib/org";
import { day } from "@/lib/format";
import { ChoosePlan, DevPlan, ManageBilling } from "@/components/plan-actions";

export const metadata = { title: "Plan & billing" };

export default async function Billing({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [{ active }, { checkout }] = await Promise.all([activeOrg(), searchParams]);
  const data = await overview(active.id);
  if (!data) return <p className="text-sm text-red-600">Could not load billing.</p>;
  const current = data.plan.id;
  const manage = canManage(data.role);
  const rank = (id: string) => PLAN_ORDER.indexOf(id as (typeof PLAN_ORDER)[number]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Plan & billing</h1>
          <p className="text-sm text-neutral-500">
            {data.plan.name}
            {data.billing.currentPeriodEnd && ` · renews ${day(data.billing.currentPeriodEnd)}`}
            {data.billing.status && data.billing.status !== "active" && ` · ${data.billing.status}`}
            . Billed per organisation; limits apply on every linked instance.
          </p>
        </div>
        {manage && data.billing.configured && data.billing.hasCustomer && <ManageBilling orgId={active.id} />}
      </div>

      {checkout === "success" && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Thanks! Your plan updates as soon as Stripe confirms the payment (usually seconds). Linked instances pick it up on their next heartbeat.</p>}
      {checkout === "cancelled" && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">Checkout cancelled. Nothing was charged.</p>}
      {!data.billing.configured && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">Online payments aren&apos;t enabled on this portal yet.</p>}
      {data.billing.devOverride && manage && <DevPlan orgId={active.id} plans={PLAN_ORDER.map((id) => ({ id, name: PLANS[id].name }))} current={current} />}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current;
          return (
            <div key={id} className={`flex flex-col rounded-lg border bg-white p-4 ${isCurrent ? "border-accent ring-1 ring-accent" : "border-neutral-200"}`}>
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">{formatPrice(p)}<span className="text-sm font-normal text-neutral-500">{p.priceCents ? "/mo" : ""}</span></p>
              <p className="mt-1 text-xs text-neutral-500">{p.tagline}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-neutral-700">
                {p.highlights.map((h) => <li key={h}>· {h}</li>)}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <p className="py-2 text-center text-sm font-medium text-accent">Current plan</p>
                ) : p.priceCents === null ? (
                  <p className="py-2 text-center text-xs text-neutral-500">Cancel your subscription to return to Free</p>
                ) : manage && data.billing.configured ? (
                  <ChoosePlan orgId={active.id} plan={id} label={rank(id) > rank(current) ? `Upgrade to ${p.name}` : `Switch to ${p.name}`} primary={rank(id) > rank(current)} />
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
