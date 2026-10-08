# @qubo-portal/kb

What a good front desk knows, written once and read by people, the pricing page and the
support assistant. Index: [INDEX.md](INDEX.md).

## Rules

- **Numbers are never typed.** Prices, limits and durations are `{{placeholders}}` resolved
  from `@qubo-portal/plans` (PLANS, SERVICES, POLICIES, HOSTING) and `@qubo/protocol`. Change
  the catalogue, every entry follows. The full key list is `FACTS` in `src/facts.ts`.
- **Rules live in code first.** A new business rule goes into `POLICIES` (and the code that
  enforces it); the entry explains it in human words.
- **Audience is a hard boundary:** `public` ⊂ `customer` ⊂ `staff`. The API derives it from
  the session; callers can narrow, never widen. Customer-specific data (servers, IPs,
  invoices) is never written into an entry; authorised tools fetch it at answer time.
- **`legal: true`** entries are binding wording. Bump `updated` and note the change in the
  commit message; never rewrite them silently.

## Adding an entry

1. Create `entries/<id>.md`:
   ```md
   ---
   id: <id>
   title: Human title
   audience: public | customer | staff
   kind: policy | fact | howto | faq
   legal: false
   updated: YYYY-MM-DD
   summary: One sentence the assistant can answer with.
   tags: [synonyms, people, actually, type]
   ---
   Body in markdown with {{plans.starter.price}}-style facts.
   ```
2. `pnpm --filter @qubo-portal/kb build` (regenerates `INDEX.md` and `src/entries.generated.ts`).
3. `pnpm --filter @qubo-portal/kb test`: fails on unknown facts, stale output, or audience leaks.

## Reading

- Code: `list(audience)`, `get(id, audience)`, `search(q, audience)`, `render(text)`.
- HTTP: `GET /v1/kb[?q=…][&audience=…]`, `GET /v1/kb/:id`. Staff = verified email in
  `PORTAL_STAFF_EMAILS` until the portal has staff roles.

Search is keyword ranking for now; pgvector embeddings replace it when the KB plus tickets
outgrow it, behind the same audience filter.
