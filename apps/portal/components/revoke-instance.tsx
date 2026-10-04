"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Revoking stops heartbeats and licence renewals; the instance keeps running and falls back to Free once its licence lapses. */
export function RevokeInstance({ orgId, instanceId, name }: { orgId: string; instanceId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      disabled={pending}
      className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      onClick={async () => {
        if (!confirm(`Revoke "${name}"?\n\nThe instance keeps running. It stops receiving licence renewals and update notices, and drops to Free limits when its current licence expires. To re-link it later, create a new token.`)) return;
        setPending(true);
        await fetch(`/api/v1/orgs/${orgId}/instances/${instanceId}/revoke`, { method: "POST" });
        setPending(false);
        router.refresh();
      }}
    >
      Revoke
    </button>
  );
}
