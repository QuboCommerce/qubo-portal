/**
 * Pricing catalogue: the single source for the marketing pricing table and the
 * limits the portal signs into licences. Billing unit = organisation.
 */
import type { LicenseClaims, Plan } from "@qubo/protocol";

export type PlanId = Plan;
export type Limits = LicenseClaims["limits"];

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in euro cents; null = free. */
  priceCents: number | null;
  per: "org" | "account" | null;
  tagline: string;
  limits: Limits;
  features: string[];
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

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: null,
    per: null,
    tagline: "One site, the full editor, your own server.",
    limits: { sitesPerOrg: 1, instances: 1, seats: 2, customDomainsPerSite: 1, cubiclesPerSite: 1 },
    features: [],
    highlights: ["1 site", "1 self-hosted instance", "2 staff seats", "Studio, catalogue, orders, inbox"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceCents: 2400,
    per: "org",
    tagline: "A few sites, AI on your own key.",
    limits: { sitesPerOrg: 4, instances: 4, seats: 5, customDomainsPerSite: null, cubiclesPerSite: 10 },
    features: [FEATURES.ai, FEATURES.noBadge],
    highlights: ["4 sites", "4 instances", "5 seats", "Unlimited domains", "AI (bring your own key)"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceCents: 4900,
    per: "org",
    tagline: "B2B pricing, multiple languages, paid apps.",
    limits: { sitesPerOrg: 10, instances: 8, seats: 15, customDomainsPerSite: null, cubiclesPerSite: 25 },
    features: [FEATURES.ai, FEATURES.noBadge, FEATURES.paidCubicles, FEATURES.b2bPricing, FEATURES.multiLocale],
    highlights: ["10 sites", "8 instances", "15 seats", "B2B price lists", "Multi-locale", "Paid apps"],
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceCents: 9900,
    per: "account",
    tagline: "Every client in one panel.",
    limits: { sitesPerOrg: null, instances: null, seats: null, customDomainsPerSite: null, cubiclesPerSite: null },
    features: [FEATURES.ai, FEATURES.noBadge, FEATURES.paidCubicles, FEATURES.b2bPricing, FEATURES.multiLocale, FEATURES.panel],
    highlights: ["Unlimited sites and instances", "Cross-org panel view", "Everything in Growth"],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "growth", "agency"];

export const formatPrice = (p: PlanDef) =>
  p.priceCents === null ? "€0" : `€${(p.priceCents / 100).toFixed(0)}`;
