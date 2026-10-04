import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { license } from "@qubo-portal/db/schema";
import { PLANS, type PlanId } from "@qubo-portal/plans";

/** Paid plans are sold through Stripe prices carrying this lookup key (created by `pnpm stripe:setup`). */
export const lookupKey = (plan: PlanId) => `qubo_${plan}_monthly`;
const planFromLookupKey = (key: string | null | undefined): PlanId | null => {
  const m = key?.match(/^qubo_([a-z]+)_monthly$/);
  return m && m[1] in PLANS ? (m[1] as PlanId) : null;
};

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}
export const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

/** Dev-only: lets the portal switch plans without Stripe. Never on in production builds. */
export const devPlanOverride = () => process.env.NODE_ENV !== "production" && process.env.PORTAL_DEV_PLAN_OVERRIDE === "1";

export async function licenseRow(organizationId: string) {
  const [row] = await db.select().from(license).where(eq(license.organizationId, organizationId));
  return row ?? null;
}

export async function setLicense(organizationId: string, values: Partial<typeof license.$inferInsert>) {
  await db
    .insert(license)
    .values({ organizationId, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: license.organizationId, set: { ...values, updatedAt: new Date() } });
}

async function priceFor(s: Stripe, plan: PlanId) {
  const { data } = await s.prices.list({ lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No active Stripe price with lookup key ${lookupKey(plan)}; run pnpm stripe:setup`);
  return data[0];
}

export async function checkoutUrl(input: { organizationId: string; plan: PlanId; email: string; returnUrl: string }) {
  const s = stripe();
  if (!s) throw new Error("billing_not_configured");
  const price = await priceFor(s, input.plan);
  const existing = await licenseRow(input.organizationId);
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: input.organizationId,
    ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : { customer_email: input.email }),
    subscription_data: { metadata: { organizationId: input.organizationId, plan: input.plan } },
    metadata: { organizationId: input.organizationId, plan: input.plan },
    allow_promotion_codes: true,
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" },
    success_url: `${input.returnUrl}?checkout=success`,
    cancel_url: `${input.returnUrl}?checkout=cancelled`,
  });
  return session.url!;
}

export async function customerPortalUrl(organizationId: string, returnUrl: string) {
  const s = stripe();
  if (!s) throw new Error("billing_not_configured");
  const row = await licenseRow(organizationId);
  if (!row?.stripeCustomerId) throw new Error("no_customer");
  const session = await s.billingPortal.sessions.create({ customer: row.stripeCustomerId, return_url: returnUrl });
  return session.url;
}

/**
 * Stripe statuses → licence. past_due keeps the plan (Stripe is retrying and instances
 * have their own 7-day grace on top); anything terminal drops the org to Free.
 */
const ACTIVE = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

async function syncSubscription(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) return;
  const item = sub.items.data[0];
  const plan = planFromLookupKey(item?.price.lookup_key) ?? planFromLookupKey(`qubo_${sub.metadata.plan}_monthly`) ?? "free";
  const live = ACTIVE.has(sub.status);
  await setLicense(organizationId, {
    plan: live ? plan : "free",
    status: live ? "active" : sub.status,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
  });
}

/** Verifies and applies one webhook event. Throws on bad signature. */
export async function handleWebhook(rawBody: string, signature: string) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) throw new Error("billing_not_configured");
  const event = await s.webhooks.constructEventAsync(rawBody, signature, secret);
  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object;
      if (cs.mode === "subscription" && cs.subscription) {
        const sub = await s.subscriptions.retrieve(typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id);
        if (!sub.metadata.organizationId && cs.client_reference_id) sub.metadata.organizationId = cs.client_reference_id;
        await syncSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object);
      break;
  }
  return event.type;
}
