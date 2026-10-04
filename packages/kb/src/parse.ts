export const AUDIENCES = ["public", "customer", "staff"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const KINDS = ["policy", "fact", "howto", "faq"] as const;
export type Kind = (typeof KINDS)[number];

export type EntryMeta = {
  id: string;
  title: string;
  /** Lowest audience allowed to read it: public ⊂ customer ⊂ staff. */
  audience: Audience;
  kind: Kind;
  /** Binding wording (terms, plan rules). Changes need a dated changelog line. */
  legal: boolean;
  updated: string;
  summary: string;
  tags: string[];
};
export type RawEntry = EntryMeta & { body: string; file: string };

/** Minimal frontmatter: `key: value`, `tags: [a, b]`. No dependency on purpose. */
export function parseEntry(file: string, text: string): RawEntry {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]!] = kv[2]!.replace(/^"(.*)"$/, "$1");
  }
  const need = (k: string) => {
    if (!meta[k]) throw new Error(`${file}: frontmatter needs "${k}"`);
    return meta[k]!;
  };
  const audience = need("audience") as Audience;
  const kind = need("kind") as Kind;
  if (!AUDIENCES.includes(audience)) throw new Error(`${file}: audience must be one of ${AUDIENCES.join(", ")}`);
  if (!KINDS.includes(kind)) throw new Error(`${file}: kind must be one of ${KINDS.join(", ")}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(need("updated"))) throw new Error(`${file}: updated must be YYYY-MM-DD`);
  return {
    id: need("id"),
    title: need("title"),
    audience,
    kind,
    legal: meta.legal === "true",
    updated: meta.updated!,
    summary: need("summary"),
    tags: (meta.tags ?? "").replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean),
    body: m[2]!.trim(),
    file,
  };
}

export const canRead = (reader: Audience, entry: Audience) => AUDIENCES.indexOf(reader) >= AUDIENCES.indexOf(entry);
