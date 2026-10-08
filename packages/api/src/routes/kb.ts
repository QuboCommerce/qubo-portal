import { Elysia } from "elysia";
import { get, list, search, type Audience } from "@qubo-portal/kb";
import { sessionOf } from "../lib/auth";

/** Staff until the portal has staff roles: verified emails in PORTAL_STAFF_EMAILS. */
const staffEmails = () => new Set((process.env.PORTAL_STAFF_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

/** Who is asking decides what they read. The caller can't widen it; `?audience=` can only narrow. */
async function audienceOf(headers: Headers, requested: unknown): Promise<Audience> {
  const session = await sessionOf(headers).catch(() => null);
  const max: Audience = !session?.user ? "public" : session.user.emailVerified && staffEmails().has(session.user.email.toLowerCase()) ? "staff" : "customer";
  const order: Audience[] = ["public", "customer", "staff"];
  const want = order.includes(requested as Audience) ? (requested as Audience) : max;
  return order[Math.min(order.indexOf(want), order.indexOf(max))]!;
}

export const kb = new Elysia({ prefix: "/kb" })
  .get("/", async ({ request, query }) => {
    const audience = await audienceOf(request.headers, query.audience);
    const q = typeof query.q === "string" ? query.q.slice(0, 200) : "";
    return { audience, entries: q ? search(q, audience) : list(audience) };
  })
  .get("/:id", async ({ request, params, query, set }) => {
    const entry = get(params.id, await audienceOf(request.headers, query.audience));
    if (!entry) return (set.status = 404), { error: "not_found" };
    return entry;
  });
