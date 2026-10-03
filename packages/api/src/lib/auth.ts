import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@qubo-portal/db/client";
import * as schema from "@qubo-portal/db/schema";

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);

/**
 * Accounts and organisations. The portal app proxies /api/auth/* here
 * same-origin, so session cookies are host-only on the portal host and
 * BETTER_AUTH_URL is the portal's public URL, not this API's.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [organization()],
  advanced: { trustedProxyHeaders: true },
});

export type Session = typeof auth.$Infer.Session;

/** Session for a request, or null. */
export const sessionOf = (headers: Headers) => auth.api.getSession({ headers });
