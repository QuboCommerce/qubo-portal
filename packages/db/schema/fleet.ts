// Instances (self-hosted or cloud Qubo installs), licences and releases.
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const planEnum = pgEnum("plan", ["free", "starter", "growth", "agency"]);
export const channelEnum = pgEnum("channel", ["stable", "beta", "alpha"]);

/** One row per org with a paid plan; no row = Free. Filled by Stripe webhooks (Phase 5). */
export const license = pgTable("license", {
  organizationId: text("organization_id").primaryKey().references(() => organization.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One-time token shown in the portal, consumed by `qubo register <token>`. Stored hashed. */
export const registrationToken = pgTable("registration_token", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const instance = pgTable(
  "instance",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Raw Ed25519 public key, base64url. */
    publicKey: text("public_key").notNull(),
    appVersion: text("app_version").notNull(),
    channel: channelEnum("channel").notNull().default("stable"),
    protocolVersion: integer("protocol_version").notNull().default(1),
    lastSeenAt: timestamp("last_seen_at"),
    lastHealth: jsonb("last_health").$type<{ db: boolean; api: boolean; storefront: boolean }>(),
    lastUsage: jsonb("last_usage").$type<{ orgs: number; sites: number; seats: number; storageMB: number }>(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("instance_org_idx").on(t.organizationId)],
);

/** Heartbeat timeline; pruned to 30 days by a job (later). */
export const heartbeat = pgTable(
  "heartbeat",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull().references(() => instance.id, { onDelete: "cascade" }),
    appVersion: text("app_version").notNull(),
    health: jsonb("health").notNull(),
    usage: jsonb("usage").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (t) => [index("heartbeat_instance_idx").on(t.instanceId, t.receivedAt)],
);

export const release = pgTable("release", {
  version: text("version").primaryKey(),
  channel: channelEnum("channel").notNull().default("stable"),
  notes: text("notes").notNull().default(""),
  deprecated: boolean("deprecated").notNull().default(false),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
});
