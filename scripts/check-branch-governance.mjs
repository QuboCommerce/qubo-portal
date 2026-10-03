#!/usr/bin/env node
// Branch governance: validates a PR's head → base pair.
// usage: node scripts/check-branch-governance.mjs <head> <base>   (CI: GITHUB_HEAD_REF / GITHUB_BASE_REF)
// SOLO_MODE=1 allows work branches straight into staging (no sprint branch while there's one dev).
const head = process.argv[2] ?? process.env.GITHUB_HEAD_REF;
const base = process.argv[3] ?? process.env.GITHUB_BASE_REF;
const solo = process.env.SOLO_MODE === "1";

export const PATTERNS = {
  work: /^[a-z0-9]+\/(feat|fix|refactor|docs|chore|infra|experiment)-[a-z0-9]+(-[a-z0-9]+)*$/,
  sprint: /^sprint\/\d{4}-(0[1-9]|1[0-2])-[a-z0-9]+(-[a-z0-9]+)*$/,
  hotfix: /^hotfix\/[a-z0-9]+(-[a-z0-9]+)*$/,
  release: /^changeset-release\/(staging|main)$/,
};

export function kind(branch) {
  if (branch === "main" || branch === "staging") return branch;
  return Object.entries(PATTERNS).find(([, re]) => re.test(branch))?.[0] ?? null;
}

export function check(head, base, solo) {
  const h = kind(head), b = kind(base);
  if (!h) return `"${head}" does not match the branch grammar: <owner>/(feat|fix|refactor|docs|chore|infra|experiment)-<slug>, sprint/YYYY-MM-<topic>, hotfix/<slug>`;
  const allowed = {
    work: ["sprint", ...(solo ? ["staging"] : [])],
    sprint: ["staging"],
    hotfix: ["main", "staging"],
    staging: ["main"],
    release: [head.slice("changeset-release/".length)],
  }[h] ?? [];
  if (!allowed.includes(b === "sprint" ? "sprint" : base)) {
    return `${h} branch "${head}" may not merge into "${base}" (allowed: ${allowed.join(", ") || "nothing"}${h === "work" && !solo ? "; staging needs SOLO_MODE=1" : ""})`;
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!head || !base) {
    console.error("usage: check-branch-governance.mjs <head> <base>");
    process.exit(2);
  }
  const err = check(head, base, solo);
  if (err) {
    console.error(`✗ ${err}`);
    process.exit(1);
  }
  console.log(`✓ ${head} → ${base}${solo ? " (solo mode)" : ""}`);
}
