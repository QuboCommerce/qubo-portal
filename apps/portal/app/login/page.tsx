import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-api";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (await getSession()) redirect("/");
  const { mode } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-semibold tracking-wide text-accent">QUBO</p>
        <h1 className="mt-1 text-2xl font-semibold">{mode === "signup" ? "Create your account" : "Sign in to the portal"}</h1>
        <p className="mt-1 text-sm text-neutral-500">Organisations, instances and licences.</p>
      </div>
      <AuthForm mode={mode === "signup" ? "signup" : "signin"} />
    </main>
  );
}
