import { Elysia } from "elysia";
import { handleWebhook } from "../lib/billing";

/** Stripe → portal. Raw body is required for signature verification. */
export const billingWebhook = new Elysia().post(
  "/stripe/webhook",
  async ({ body, headers, set }) => {
    const sig = headers["stripe-signature"];
    if (!sig) return (set.status = 400), { error: "unsigned" };
    try {
      const type = await handleWebhook(String(body ?? ""), sig);
      return { received: true, type };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "error";
      if (msg === "billing_not_configured") return (set.status = 503), { error: msg };
      console.warn("[stripe] webhook rejected:", msg);
      return (set.status = 400), { error: "invalid_event" };
    }
  },
  { parse: "text" },
);
