"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const input = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-accent";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")), password = String(f.get("password"));
    setPending(true);
    setError(null);
    const res = mode === "signup"
      ? await authClient.signUp.email({ email, password, name: String(f.get("name")) })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) return setError(res.error.message ?? "Something went wrong");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === "signup" && <input name="name" placeholder="Your name" required className={input} />}
      <input name="email" type="email" placeholder="Email" autoComplete="email" required className={input} />
      <input name="password" type="password" placeholder="Password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required className={input} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-neutral-500">
        {mode === "signup" ? <>Have an account? <Link className="underline" href="/login">Sign in</Link></> : <>New here? <Link className="underline" href="/login?mode=signup">Create an account</Link></>}
      </p>
    </form>
  );
}
