/**
 * Qubo knowledgebase: what a front desk knows. Entries are markdown in
 * `entries/` with frontmatter; numbers are `{{placeholders}}` resolved from
 * @qubo-portal/plans and @qubo/protocol at read time, so prose never goes stale.
 *
 * Audience scoping is enforced here, not by whoever calls it: a reader only
 * ever receives entries at or below its audience (public ⊂ customer ⊂ staff).
 * Customer-specific data (servers, IPs, invoices) never lives in the KB; it is
 * fetched by authorised tools at answer time.
 */
import { FACTS } from "./facts";
import { ENTRIES } from "./entries.generated";
import { canRead, type Audience, type EntryMeta, type RawEntry } from "./parse";

export { AUDIENCES, KINDS, canRead, type Audience, type Kind, type EntryMeta } from "./parse";
export { FACTS } from "./facts";

export type Entry = EntryMeta & { body: string };

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Throws on an unknown key: a typo must fail the test suite, not reach a customer. */
export function render(text: string, facts: Record<string, string> = FACTS): string {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const v = facts[key];
    if (v === undefined) throw new Error(`kb: unknown fact {{${key}}}`);
    return v;
  });
}

export const placeholdersOf = (text: string) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]!);

const toEntry = ({ file: _file, ...e }: RawEntry): Entry => ({ ...e, summary: render(e.summary), body: render(e.body) });

export function list(audience: Audience): EntryMeta[] {
  return ENTRIES.filter((e) => canRead(audience, e.audience)).map(({ body: _b, file: _f, ...meta }) => ({ ...meta, summary: render(meta.summary) }));
}

export function get(id: string, audience: Audience): Entry | null {
  const e = ENTRIES.find((x) => x.id === id);
  return e && canRead(audience, e.audience) ? toEntry(e) : null;
}

/**
 * Keyword ranking over title, tags, summary and body. Good enough for a few
 * dozen entries; swap for pgvector embeddings when the KB or tickets outgrow it,
 * keeping the same audience filter in front.
 */
export function search(query: string, audience: Audience, limit = 5): Entry[] {
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  if (!terms.length) return [];
  return ENTRIES.filter((e) => canRead(audience, e.audience))
    .map((e) => {
      const entry = toEntry(e);
      const fields: [string, number][] = [[entry.title, 5], [entry.tags.join(" "), 4], [entry.summary, 3], [entry.body, 1]];
      const score = terms.reduce((sum, t) => sum + fields.reduce((s, [text, w]) => s + (text.toLowerCase().includes(t) ? w : 0), 0), 0);
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}
