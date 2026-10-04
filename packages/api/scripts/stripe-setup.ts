/**
 * Creates/updates the Stripe catalogue from @qubo-portal/plans. Idempotent: one product per paid
 * plan (metadata.plan), one active monthly EUR price per product with lookup key qubo_<plan>_monthly.
 * A price change creates a new price and moves the lookup key to it (existing subscribers keep theirs).
 *
 *   STRIPE_SECRET_KEY=sk_test_… pnpm stripe:setup
 */
import Stripe from "stripe";
import { PLANS, PLAN_ORDER } from "@qubo-portal/plans";
import { lookupKey } from "../src/lib/billing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "test";
console.log(`Stripe catalogue sync (${mode} mode)`);

for (const id of PLAN_ORDER) {
  const plan = PLANS[id];
  if (plan.priceCents === null) continue;

  const found = await stripe.products.search({ query: `metadata['plan']:'${id}'` });
  const product =
    found.data[0] ??
    (await stripe.products.create({ name: `Qubo ${plan.name}`, description: plan.tagline, metadata: { plan: id } }));
  if (product.name !== `Qubo ${plan.name}` || product.description !== plan.tagline) {
    await stripe.products.update(product.id, { name: `Qubo ${plan.name}`, description: plan.tagline });
  }

  const lk = lookupKey(id);
  const { data: [current] } = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 });
  if (current && current.unit_amount === plan.priceCents && current.currency === "eur" && current.recurring?.interval === "month") {
    console.log(`  ✓ ${plan.name.padEnd(8)} €${plan.priceCents / 100}/mo  ${current.id}`);
    continue;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: plan.priceCents,
    recurring: { interval: "month" },
    lookup_key: lk,
    transfer_lookup_key: true,
    tax_behavior: "exclusive",
    metadata: { plan: id },
  });
  if (current) await stripe.prices.update(current.id, { active: false });
  console.log(`  + ${plan.name.padEnd(8)} €${plan.priceCents / 100}/mo  ${price.id}${current ? ` (replaces ${current.id})` : ""}`);
}
console.log("Done. Webhook endpoint: <PORTAL_API_URL>/v1/stripe/webhook");
