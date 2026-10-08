import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generated, loadEntries } from "../scripts/build";
import { FACTS, get, list, placeholdersOf, render, search } from "./index";

const root = resolve(import.meta.dir, "..");

describe("knowledgebase", () => {
  test("generated files match entries/ (run `pnpm --filter @qubo-portal/kb build`)", () => {
    const { ts, index } = generated(loadEntries());
    expect(readFileSync(resolve(root, "src/entries.generated.ts"), "utf8")).toBe(ts);
    expect(readFileSync(resolve(root, "INDEX.md"), "utf8")).toBe(index);
  });

  test("every placeholder resolves", () => {
    for (const e of loadEntries()) {
      for (const key of placeholdersOf(e.summary + e.body)) expect({ file: e.file, key, known: key in FACTS }).toEqual({ file: e.file, key, known: true });
    }
  });

  test("unknown placeholders throw instead of leaking", () => {
    expect(() => render("{{plans.platinum.price}}")).toThrow();
  });

  test("prices come from the catalogue", () => {
    expect(get("pricing", "public")!.summary).toContain(FACTS["plans.starter.price"]!);
    expect(get("pricing", "public")!.body).not.toContain("{{");
  });

  test("audiences nest: public ⊂ customer ⊂ staff", () => {
    const ids = (a: "public" | "customer" | "staff") => list(a).map((e) => e.id);
    expect(ids("public")).not.toContain("linking-an-instance");
    expect(ids("public")).not.toContain("customer-data-access");
    expect(ids("customer")).toContain("linking-an-instance");
    expect(ids("customer")).not.toContain("customer-data-access");
    expect(ids("staff")).toEqual(expect.arrayContaining([...ids("customer"), "customer-data-access"]));
  });

  test("get and search never return entries above the reader's audience", () => {
    expect(get("customer-data-access", "public")).toBeNull();
    expect(search("customer ip address staff", "public").map((e) => e.id)).not.toContain("customer-data-access");
    expect(search("customer ip address staff", "staff").map((e) => e.id)).toContain("customer-data-access");
  });

  test("search finds the obvious entry", () => {
    expect(search("how much does it cost?", "public")[0]?.id).toBe("pricing");
    expect(search("move my site to another company", "public")[0]?.id).toBe("site-transfer");
  });
});
