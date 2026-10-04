/**
 * Every value an entry may quote, flattened to dotted keys: `{{plans.starter.price}}`.
 * Built from the typed catalogue, so a price or limit change reaches every entry
 * (and the chatbot) without editing prose.
 */
import { FREE_LIMITS, HEARTBEAT_INTERVAL_SECONDS, LICENCE_GRACE_SECONDS, LICENCE_TTL_SECONDS, REGISTRATION_TOKEN_TTL_SECONDS } from "@qubo/protocol";
import { FEATURE_LABELS, formatCents, formatPrice, HOSTING, PLAN_ORDER, PLANS, POLICIES, SERVICES } from "@qubo-portal/plans";

const limit = (n: number | null) => (n === null ? "unlimited" : String(n));
const days = (s: number) => `${Math.round(s / 86400)} days`;
const hours = (s: number) => `${Math.round(s / 3600)} hours`;

export function buildFacts(): Record<string, string> {
  const f: Record<string, string> = {};
  for (const id of PLAN_ORDER) {
    const p = PLANS[id];
    const k = `plans.${id}`;
    f[`${k}.name`] = p.name;
    f[`${k}.price`] = formatPrice(p);
    f[`${k}.tagline`] = p.tagline;
    f[`${k}.audience`] = p.audience;
    for (const [lk, lv] of Object.entries(p.limits)) f[`${k}.${lk}`] = limit(lv);
    f[`${k}.features`] = p.features.map((x) => FEATURE_LABELS[x]).join(", ") || "none";
    f[`${k}.highlights`] = p.highlights.join("; ");
  }
  f["plans.table"] = PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return `| ${p.name} | ${formatPrice(p)}${p.priceCents ? "/month" : ""} | ${limit(p.limits.orgs)} | ${limit(p.limits.sites)} | ${limit(p.limits.instances)} | ${limit(p.limits.seats)} |`;
  }).join("\n");
  for (const s of Object.values(SERVICES)) {
    f[`services.${s.id}.name`] = s.name;
    f[`services.${s.id}.price`] = formatCents(s.priceCents);
    f[`services.${s.id}.description`] = s.description;
    f[`services.${s.id}.includedIn`] = PLAN_ORDER.filter((id) => PLANS[id].includes.includes(s.id)).map((id) => PLANS[id].name).join(", ") || "no plan";
  }
  for (const [k, v] of Object.entries(POLICIES)) f[`policies.${k}`] = String(v);
  for (const h of Object.values(HOSTING)) {
    f[`hosting.${h.id}.name`] = h.name;
    f[`hosting.${h.id}.status`] = h.status;
    f[`hosting.${h.id}.summary`] = h.summary;
  }
  f["free.limits.sites"] = limit(FREE_LIMITS.sites);
  f["licence.validity"] = days(LICENCE_TTL_SECONDS);
  f["licence.grace"] = days(LICENCE_GRACE_SECONDS);
  f["licence.heartbeat"] = hours(HEARTBEAT_INTERVAL_SECONDS);
  f["registration.tokenValidity"] = hours(REGISTRATION_TOKEN_TTL_SECONDS);
  f["currency"] = "EUR";
  f["vat"] = "Prices exclude VAT.";
  return f;
}

export const FACTS = buildFacts();
