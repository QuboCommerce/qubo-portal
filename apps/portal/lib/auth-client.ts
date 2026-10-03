"use client";
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// Same origin: /api/auth/* is rewritten to the portal API (next.config.ts).
export const authClient = createAuthClient({ plugins: [organizationClient()] });
