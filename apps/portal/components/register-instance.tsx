"use client";
import { useState } from "react";

/** Creates a one-time token (1 h) and shows the command to run on the instance. */
export function RegisterInstance({ orgId, portalApiUrl }: { orgId: string; portalApiUrl: string }) {
  const [cmd, setCmd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white"
        onClick={async () => {
          setError(null);
          const res = await fetch(`/api/v1/orgs/${orgId}/registration-tokens`, { method: "POST" });
          if (!res.ok) return setError(`Could not create a token (${res.status})`);
          const { token } = (await res.json()) as { token: string };
          setCmd(`pnpm qubo register ${token}${portalApiUrl ? ` --portal ${portalApiUrl}` : ""}`);
        }}
      >
        Register instance
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cmd && (
        <div className="max-w-full rounded-md bg-ink p-3 text-xs text-white">
          <p className="mb-1 text-neutral-400">Run on the server, inside the qubo-stack checkout (valid 1 hour, single use):</p>
          <code className="break-all">{cmd}</code>
        </div>
      )}
    </div>
  );
}
