"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function go(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  return { ok: res.ok, ...data };
}

const messages: Record<string, string> = {
  billing_not_configured: "Billing isn't configured on this portal yet.",
  no_customer: "No billing account yet. Choose a plan first.",
  forbidden: "Only owners and admins can change the plan.",
};

export function ChoosePlan({ orgId, plan, label, primary }: { orgId: string; plan: string; label: string; primary?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={pending}
        className={`w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${primary ? "bg-accent text-white" : "border border-neutral-300 bg-white"}`}
        onClick={async () => {
          setError(null);
          setPending(true);
          const r = await go(`/api/v1/orgs/${orgId}/billing/checkout`, { plan });
          if (r.url) return void (window.location.href = r.url);
          setPending(false);
          setError(messages[r.error ?? ""] ?? "Something went wrong.");
        }}
      >
        {pending ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ManageBilling({ orgId }: { orgId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        onClick={async () => {
          setPending(true);
          const r = await go(`/api/v1/orgs/${orgId}/billing/portal`);
          if (r.url) return void (window.location.href = r.url);
          setPending(false);
          setError(messages[r.error ?? ""] ?? "Something went wrong.");
        }}
      >
        {pending ? "Opening…" : "Invoices & payment method"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/** Dev only (PORTAL_DEV_PLAN_OVERRIDE=1, non-production): set the plan without Stripe. */
export function DevPlan({ orgId, plans, current }: { orgId: string; plans: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-medium">Dev plan override:</span>
      {plans.map((p) => (
        <button
          key={p.id}
          disabled={p.id === current}
          className="rounded border border-amber-400 bg-white px-2 py-0.5 disabled:bg-amber-200"
          onClick={async () => { await go(`/api/v1/orgs/${orgId}/billing/dev-plan`, { plan: p.id }); router.refresh(); }}
        >
          {p.name}
        </button>
      ))}
      <span className="text-amber-700">Linked instances pick it up on their next heartbeat (or “Refresh now” in the admin).</span>
    </div>
  );
}
