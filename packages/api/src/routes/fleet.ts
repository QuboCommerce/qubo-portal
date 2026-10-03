import { Elysia } from "elysia";
import { and, eq, gt, isNull, count } from "drizzle-orm";
import { db } from "@qubo-portal/db/client";
import { heartbeat, instance, registrationToken } from "@qubo-portal/db/schema";
import { PLANS } from "@qubo-portal/plans";
import {
  HeartbeatRequest,
  MAX_CLOCK_SKEW_SECONDS,
  PROTOCOL_VERSION,
  RegisterInstanceRequest,
  SIGNATURE_HEADERS,
  signingPayload,
  type HeartbeatResponse,
  type RegisterInstanceResponse,
} from "@qubo/protocol";
import { newId, sha256Hex, verifyEd25519 } from "../lib/crypto";
import { mintLicence, planOf } from "../lib/licence";
import { latestRelease } from "./releases";
import { compareVersions } from "../lib/crypto";

const apiBase = () => process.env.PORTAL_API_URL ?? "";

/** Instance ↔ portal endpoints (@qubo/protocol v1). Called server-to-server by instances. */
export const fleet = new Elysia()
  .post("/instances/register", async ({ body, set }) => {
    const parsed = RegisterInstanceRequest.safeParse(body);
    if (!parsed.success) return (set.status = 400), { error: "invalid_request", issues: parsed.error.issues };
    const req = parsed.data;

    const [tok] = await db
      .select()
      .from(registrationToken)
      .where(and(eq(registrationToken.tokenHash, await sha256Hex(req.token)), isNull(registrationToken.usedAt), gt(registrationToken.expiresAt, new Date())));
    if (!tok) return (set.status = 401), { error: "invalid_token" };

    const limit = PLANS[await planOf(tok.organizationId)].limits.instances;
    const [{ n }] = await db.select({ n: count() }).from(instance).where(and(eq(instance.organizationId, tok.organizationId), isNull(instance.revokedAt)));
    if (limit !== null && n >= limit) return (set.status = 402), { error: "license.instances_exceeded", limit };

    const id = newId("ins");
    await db.transaction(async (tx) => {
      await tx.update(registrationToken).set({ usedAt: new Date() }).where(eq(registrationToken.id, tok.id));
      await tx.insert(instance).values({
        id,
        organizationId: tok.organizationId,
        name: req.name,
        publicKey: req.publicKey,
        appVersion: req.appVersion,
        channel: req.channel,
      });
    });
    set.status = 201;
    return { instanceId: id, organizationId: tok.organizationId, jwksUrl: `${apiBase()}/.well-known/jwks.json` } satisfies RegisterInstanceResponse;
  })
  .post(
    "/heartbeat",
    async ({ body, headers, set }) => {
      const raw = String(body ?? "");
      const instanceId = headers[SIGNATURE_HEADERS.instance];
      const ts = Number(headers[SIGNATURE_HEADERS.timestamp]);
      const sig = headers[SIGNATURE_HEADERS.signature];
      if (!instanceId || !sig || !Number.isFinite(ts)) return (set.status = 401), { error: "unsigned" };
      if (Math.abs(Date.now() / 1000 - ts) > MAX_CLOCK_SKEW_SECONDS) return (set.status = 401), { error: "clock_skew" };

      const [ins] = await db.select().from(instance).where(eq(instance.id, instanceId));
      if (!ins || ins.revokedAt) return (set.status = 401), { error: "unknown_instance" };
      if (!(await verifyEd25519(ins.publicKey, sig, signingPayload(ts, raw)))) return (set.status = 401), { error: "bad_signature" };

      let json: unknown;
      try { json = JSON.parse(raw); } catch { return (set.status = 400), { error: "invalid_json" }; }
      const parsed = HeartbeatRequest.safeParse(json);
      if (!parsed.success) return (set.status = 400), { error: "invalid_request", issues: parsed.error.issues };
      const hb = parsed.data;
      if (hb.instanceId !== ins.id) return (set.status = 400), { error: "instance_mismatch" };
      if (hb.protocolVersion > PROTOCOL_VERSION || hb.protocolVersion < PROTOCOL_VERSION - 1) return (set.status = 426), { error: "protocol_unsupported", supported: [PROTOCOL_VERSION - 1, PROTOCOL_VERSION] };

      const now = new Date();
      await db.update(instance).set({
        appVersion: hb.appVersion,
        channel: hb.channel,
        protocolVersion: hb.protocolVersion,
        lastSeenAt: now,
        lastHealth: hb.health,
        lastUsage: hb.usage,
      }).where(eq(instance.id, ins.id));
      await db.insert(heartbeat).values({ id: newId("hb"), instanceId: ins.id, appVersion: hb.appVersion, health: hb.health, usage: hb.usage, receivedAt: now });

      const rel = await latestRelease(hb.channel);
      const res: HeartbeatResponse = {
        licenseToken: await mintLicence(ins.id, ins.organizationId),
        ...(rel && compareVersions(rel.version, hb.appVersion) > 0 ? { release: { version: rel.version, notes: rel.notes, deprecated: rel.deprecated } } : {}),
        grants: [],
      };
      return res;
    },
    { parse: "text" },
  );
