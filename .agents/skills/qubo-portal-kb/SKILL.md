---
name: qubo-portal-kb
description: Use when changing prices, plan limits, policies or support answers, or adding knowledgebase entries.
---

# Knowledgebase and business rules

1. Business numbers and rules live in `packages/plans/src/index.ts` (PLANS, SERVICES,
   POLICIES, HOSTING). Change them there only; marketing, billing, licences and the KB follow.
2. Prose lives in `packages/kb/entries/*.md` with `{{facts}}` placeholders (keys in
   `packages/kb/src/facts.ts`). Read `packages/kb/README.md` for the format.
3. After editing: `pnpm --filter @qubo-portal/kb build && pnpm --filter @qubo-portal/kb test`.
4. Price change → also `pnpm --filter @qubo-portal/api stripe:setup` (creates a new Stripe
   price under the same lookup key; existing subscribers keep theirs until migrated).
5. Never put customer data in an entry; never lower an entry's audience without a reason.
