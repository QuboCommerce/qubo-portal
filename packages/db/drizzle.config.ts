import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

// drizzle-kit runs from packages/db, so point it at the repo root .env.
config({ path: resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "./schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
