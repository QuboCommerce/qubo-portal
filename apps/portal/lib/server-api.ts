import "server-only";
import { cookies } from "next/headers";

const API = process.env.PORTAL_API_INTERNAL_URL ?? "http://127.0.0.1:3340";
const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Server-side call to the portal API with the visitor's cookies. */
export async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T | null }> {
  const jar = await cookies();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init?.headers, cookie: jar.toString(), origin: ORIGIN },
    cache: "no-store",
  });
  const data = res.headers.get("content-type")?.includes("json") ? ((await res.json()) as T) : null;
  return { status: res.status, data };
}

export type SessionData = { user: { id: string; name: string; email: string }; session: { activeOrganizationId?: string | null } };
export type Org = { id: string; name: string; slug: string };

export const getSession = async () => (await api<SessionData | null>("/api/auth/get-session")).data;
export const listOrgs = async () => (await api<Org[]>("/api/auth/organization/list")).data ?? [];
