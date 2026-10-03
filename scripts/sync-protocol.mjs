#!/usr/bin/env node
// Copies @qubo/protocol from a qubo-stack checkout until it is published to a registry.
// usage: QUBO_STACK=../../Mostapha/qubo-stack pnpm protocol:sync   (default: ../../Mostapha/qubo-stack)
import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stack = resolve(root, process.env.QUBO_STACK ?? "../../Mostapha/qubo-stack");
const from = resolve(stack, "packages/protocol");
if (!existsSync(from)) {
  console.error(`[protocol:sync] not found: ${from} (set QUBO_STACK)`);
  process.exit(1);
}
for (const f of ["src", "package.json", "tsconfig.json"]) cpSync(resolve(from, f), resolve(root, "packages/protocol", f), { recursive: true });
const { version } = JSON.parse(readFileSync(resolve(from, "package.json"), "utf8"));
console.log(`[protocol:sync] @qubo/protocol ${version} copied from ${from}`);
