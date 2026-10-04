"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "./copy";

type Issued = { token: string; expiresAt: string };

/**
 * One-time registration token (1 h, single use). The instance owner pastes it in
 * Qubo Admin → Settings → Qubo Portal; the instance then registers its own key pair.
 */
export function AddInstance({ orgId, portalUrl, atLimit }: { orgId: string; portalUrl: string; atLimit: boolean }) {
  const router = useRouter();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState<number>(0);

  useEffect(() => {
    if (!issued) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(issued.expiresAt).getTime() - Date.now()) / 60000)));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [issued]);

  if (atLimit && !issued) {
    return (
      <p className="text-sm text-neutral-500">
        Instance limit reached. <a href="/billing" className="font-medium text-accent">Upgrade</a> or revoke one first.
      </p>
    );
  }

  return (
    <div className="w-full">
      {!issued ? (
        <div className="flex items-center justify-end gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={pending}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            onClick={async () => {
              setError(null);
              setPending(true);
              const res = await fetch(`/api/v1/orgs/${orgId}/registration-tokens`, { method: "POST" });
              setPending(false);
              if (res.status === 402) return setError("Instance limit reached for your plan.");
              if (!res.ok) return setError(`Could not create a token (${res.status}).`);
              setIssued((await res.json()) as Issued);
            }}
          >
            {pending ? "Creating…" : "Add instance"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-accent/30 bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">Link a Qubo instance</h3>
              <p className="text-sm text-neutral-500">Single use · expires in {left} min</p>
            </div>
            <button className="text-sm text-neutral-500 hover:text-ink" onClick={() => { setIssued(null); router.refresh(); }}>Done</button>
          </div>
          <ol className="mb-5 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            <li>Open the Qubo admin on the server you want to link.</li>
            <li>Go to <span className="font-medium">Settings → Qubo Portal</span>.</li>
            <li>Paste the token below; set the Portal address if it differs.</li>
            <li>Click <span className="font-medium">Link instance</span>. It appears here within seconds.</li>
          </ol>
          <div className="grid gap-3">
            <CopyField label="Registration token" value={issued.token} />
            <CopyField label="Portal address" value={portalUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
