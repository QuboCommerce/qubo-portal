// Applies packages/db/drizzle/* to DATABASE_URL. Run by the API container before it listens,
// and by `pnpm db:migrate` in dev (drizzle-kit does the same thing there).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle") });
await sql.end();
console.log("[portal-db] migrations applied");
