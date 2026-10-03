import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-api";
import { SignOut } from "@/components/sign-out";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-accent">QUBO PORTAL</p>
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <span>{s.user.email}</span>
          <SignOut />
        </div>
      </header>
      {children}
    </div>
  );
}
