/**
 * Pricing catalogue: the single source for prices, plan limits, marketing copy,
 * Stripe products (scripts/stripe-setup.ts) and the limits the portal signs into
 * licences. Change a number here and every surface follows; never restate these
 * values in prose (the knowledgebase interpolates them).
 *
 * Billing unit = one Portal account (organisation in the portal DB). Orgs and
 * sites are pooled across the account's instances: Growth's 4 sites can be
 * 4 + 0, 3 + 1 or 2 + 2 across its 2 organisations. A site slot is freed by
 * deleting the site.
 */
import type { LicenseClaims, Plan } from "@qubo/protocol";
import { FREE_LIMITS } from "@qubo/protocol";

export type PlanId = Plan;
export type Limits = LicenseClaims["limits"];

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in euro cents, VAT excluded; null = free. */
  priceCents: number | null;
  tagline: string;
  /** Who it's for; used by the pricing page and the support assistant. */
  audience: string;
  limits: Limits;
  features: Feature[];
  /** Service ids (see SERVICES) included at no charge. */
  includes: ServiceId[];
  /** Derived from limits + features; never hand-written. */
  highlights: string[];
}

export const FEATURES = {
  ai: "ai",
  paidCubicles: "paid_cubicles",
  b2bPricing: "b2b_pricing",
  multiLocale: "multi_locale",
  panel: "panel",
  noBadge: "no_badge",
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_LABELS: Record<Feature, string> = {
  ai: "AI (bring your own key)",
  paid_cubicles: "Paid apps",
  b2b_pricing: "B2B price lists",
  multi_locale: "Multiple languages",
  panel: "Cross-organisation panel",
  no_badge: "No “Made with Qubo” badge",
};

/** One-off services, billed separately unless a plan includes them. */
export const SERVICES = {
  migration: {
    id: "migration",
    name: "Assisted migration",
    priceCents: 1500,
    description: "Special cases only: we move a published site between organisations by hand, after review.",
  },
} as const;
export type ServiceId = keyof typeof SERVICES;

const n = (v: number | null, one: string, many = `${one}s`) => (v === null ? `Unlimited ${many}` : `${v} ${v === 1 ? one : many}`);

function highlightsFor(limits: Limits, features: Feature[], includes: ServiceId[]): string[] {
  return [
    n(limits.orgs, "organisation"),
    limits.orgs === 1 ? n(limits.sites, "site") : `${n(limits.sites, "site")}, split however you like`,
    n(limits.instances, "server"),
    n(limits.seats, "staff seat"),
    limits.customDomainsPerSite === null ? "Unlimited domains" : n(limits.customDomainsPerSite, "domain") + " per site",
    ...features.filter((f) => f !== FEATURES.noBadge).map((f) => FEATURE_LABELS[f]),
    ...includes.map((s) => `${SERVICES[s].name} included`),
  ];
}

type PlanInput = Omit<PlanDef, "highlights">;
const plan = (p: PlanInput): PlanDef => ({ ...p, highlights: highlightsFor(p.limits, p.features, p.includes) });

// Seats and instance counts on paid plans are provisional (instances = orgs: one server per business).
export const PLANS: Record<PlanId, PlanDef> = {
  free: plan({
    id: "free",
    name: "Free",
    priceCents: null,
    tagline: "One site, the full editor, your own server.",
    audience: "Trying Qubo, or one small business that self-hosts.",
    limits: { ...FREE_LIMITS },
    features: [],
    includes: [],
  }),
  starter: plan({
    id: "starter",
    name: "Starter",
    priceCents: 1200,
    tagline: "A second site for the same business.",
    audience: "One business with a shop and a second site (brand, landing, B2B).",
    limits: { orgs: 1, sites: 2, instances: 1, seats: 3, customDomainsPerSite: null, cubiclesPerSite: 10 },
    features: [FEATURES.ai, FEATURES.noBadge],
    includes: [],
  }),
  growth: plan({
    id: "growth",
    name: "Growth",
    priceCents: 2400,
    tagline: "Two businesses, four sites, B2B and languages.",
    audience: "Entrepreneurs running two companies, or one company with several sites.",
    limits: { orgs: 2, sites: 4, instances: 2, seats: 6, customDomainsPerSite: null, cubiclesPerSite: 25 },
    features: [FEATURES.ai, FEATURES.noBadge, FEATURES.paidCubicles, FEATURES.b2bPricing, FEATURES.multiLocale],
    includes: [],
  }),
  agency: plan({
    id: "agency",
    name: "Agency",
    priceCents: 8900,
    tagline: "Many businesses, one panel.",
    audience: "Entrepreneurs and agencies spanning several businesses.",
    limits: { orgs: 6, sites: 18, instances: 6, seats: 20, customDomainsPerSite: null, cubiclesPerSite: null },
    features: [FEATURES.ai, FEATURES.noBadge, FEATURES.paidCubicles, FEATURES.b2bPricing, FEATURES.multiLocale, FEATURES.panel],
    includes: ["migration"],
  }),
};

/**
 * Rules the product enforces. The knowledgebase quotes these; the code that
 * enforces them should import them rather than restate them.
 */
export const POLICIES = {
  /** A draft site (never published) can move to another organisation for free. */
  draftSiteTransfer: "free",
  /**
   * A published site belongs to its organisation for good: orders, customers,
   * invoices and history hang off it. Publishing asks to confirm the organisation.
   * Exceptions go through the assisted migration service.
   */
  publishedSiteTransfer: "assisted_only",
  /** A site slot is freed by deleting the site; nothing else returns it. */
  freeSiteSlot: "delete_site",
  /** Locked sites (outside the plan) stay online; only the back office closes. */
  lockedSitesStayOnline: true,
  /** No app-store review: anyone may publish. Automated scans flag abuse; humans review flags. */
  publishReview: "automated_scan_then_human_on_flag",
  /** Self-hosted instances never depend on the portal at request time. */
  selfHostedWorksOffline: true,
} as const;

/**
 * Where Qubo runs. Self-hosted is available today on every plan; cloud is
 * planned. Free cloud is deliberately "better than nothing": fine for a site
 * you need for a weekend, frustrating for a business.
 */
export const HOSTING = {
  selfHosted: {
    id: "self_hosted",
    status: "available",
    name: "Self-hosted",
    summary: "Your own server, your data. Every plan, including Free.",
  },
  cloudFree: {
    id: "cloud_free",
    status: "planned",
    name: "Free cloud",
    summary: "We host one site for free, with a Qubo watermark and a short Qubo loading screen.",
    limits: { sites: 1, ai: false, support: "none", customDomain: false, customisation: "limited" },
  },
  cloudPaid: {
    id: "cloud_paid",
    status: "planned",
    name: "Cloud",
    summary: "We host it on a paid plan: no watermark, no loading screen, support included.",
  },
} as const;

export const PLAN_ORDER: PlanId[] = ["free", "starter", "growth", "agency"];

export const formatCents = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const formatPrice = (p: { priceCents: number | null }) => (p.priceCents === null ? "€0" : formatCents(p.priceCents));
