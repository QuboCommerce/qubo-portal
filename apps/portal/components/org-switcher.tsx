"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function OrgSwitcher({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string }) {
  const router = useRouter();
  if (orgs.length < 2) return <span className="text-sm font-medium">{orgs[0]?.name}</span>;
  return (
    <select
      value={activeId}
      onChange={async (e) => { await authClient.organization.setActive({ organizationId: e.target.value }); router.refresh(); }}
      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
    >
      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
