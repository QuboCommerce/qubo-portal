"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

export function CreateOrg() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name")).trim();
        setPending(true);
        const res = await authClient.organization.create({ name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}` });
        if (!res.error && res.data) await authClient.organization.setActive({ organizationId: res.data.id });
        setPending(false);
        if (res.error) return setError(res.error.message ?? "Could not create organisation");
        router.refresh();
      }}
    >
      <input name="name" required placeholder="HM Froid" className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" />
      <button disabled={pending} className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Create</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
