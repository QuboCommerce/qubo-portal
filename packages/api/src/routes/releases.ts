import { Elysia } from "elysia";
import { desc, inArray } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { release } from "@qubo-portal/db/schema";
import { Channel } from "@qubo/protocol";
import { compareVersions } from "../lib/crypto";

// An instance on a channel also sees everything more stable than it.
const VISIBLE: Record<Channel, Channel[]> = { stable: ["stable"], beta: ["stable", "beta"], alpha: ["stable", "beta", "alpha"] };

export async function latestRelease(channel: Channel) {
  const rows = await db.select().from(release).where(inArray(release.channel, VISIBLE[channel])).orderBy(desc(release.publishedAt)).limit(50);
  return rows.sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
}

export const releases = new Elysia().get("/releases/latest", async ({ query, set }) => {
  const channel = Channel.safeParse(query.channel ?? "stable");
  if (!channel.success) return (set.status = 400), { error: "invalid_channel" };
  const rel = await latestRelease(channel.data);
  if (!rel) return (set.status = 404), { error: "no_release" };
  set.headers["cache-control"] = "public, max-age=300";
  return { version: rel.version, notes: rel.notes, deprecated: rel.deprecated, channel: rel.channel, publishedAt: rel.publishedAt };
});
