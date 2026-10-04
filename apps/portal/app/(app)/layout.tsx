import { redirect } from "next/navigation";
import { getSession, listOrgs } from "@/lib/server-api";
import { Nav } from "@/components/nav";
import { OrgSwitcher } from "@/components/org-switcher";
import { SignOut } from "@/components/sign-out";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const orgs = await listOrgs();
  const active = orgs.find((o) => o.id === s.session.activeOrganizationId) ?? orgs[0];
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold tracking-wide text-accent">QUBO PORTAL</p>
          {active && <OrgSwitcher orgs={orgs} activeId={active.id} />}
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <span className="hidden sm:inline">{s.user.email}</span>
          <SignOut />
        </div>
      </header>
      {active && <div className="mb-8"><Nav /></div>}
      {children}
    </div>
  );
}
