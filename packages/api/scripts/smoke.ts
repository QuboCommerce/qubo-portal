// End-to-end check of the portal flow, acting as a user and as a Qubo instance:
// sign up → create org → registration token → register instance → signed heartbeat → verify licence.
// usage: PORTAL=http://localhost:4010 API=http://localhost:4030 bun packages/api/scripts/smoke.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import { HeartbeatResponse, LicenseClaims, PROTOCOL_VERSION, RegisterInstanceResponse, SIGNATURE_HEADERS, signingPayload, type HeartbeatRequest } from "@qubo/protocol";

const PORTAL = process.env.PORTAL ?? "http://localhost:4010";
const API = process.env.API ?? "http://localhost:4030";
const ok = (msg: string) => console.log(`✓ ${msg}`);
const die = (msg: string, extra?: unknown): never => { console.error(`✗ ${msg}`, extra ?? ""); process.exit(1); };

let cookie = "";
async function portal(path: string, body?: unknown) {
  const res = await fetch(`${PORTAL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: PORTAL, cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (set.length) cookie = [...new Map([...cookie.split("; ").filter(Boolean), ...set].map((c) => [c.split("=")[0], c])).values()].join("; ");
  const data = await res.json().catch(() => null);
  if (!res.ok) die(`${path} → ${res.status}`, data);
  return data as any;
}

const email = `smoke+${Date.now()}@example.test`;
await portal("/api/auth/sign-up/email", { email, password: "smoke-password-1", name: "Smoke" });
ok(`signed up ${email}`);
const org = await portal("/api/auth/organization/create", { name: "Smoke Org", slug: `smoke-${Date.now()}` });
ok(`org ${org.id}`);
const { token } = await portal(`/api/v1/orgs/${org.id}/registration-tokens`, {});
ok("registration token");

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
const rawPub = Buffer.from(await crypto.subtle.exportKey("raw", publicKey)).toString("base64url");
const reg = await fetch(`${API}/v1/instances/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, name: "smoke-vps", publicKey: rawPub, appVersion: "0.0.1", channel: "stable" }),
});
const regBody = RegisterInstanceResponse.parse(await reg.json());
ok(`registered ${regBody.instanceId}`);
const again = await fetch(`${API}/v1/instances/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: "x", publicKey: rawPub, appVersion: "0.0.1", channel: "stable" }) });
if (again.status !== 401) die(`token reuse should be 401, got ${again.status}`);
ok("token is single use");

const hb: HeartbeatRequest = {
  instanceId: regBody.instanceId,
  protocolVersion: PROTOCOL_VERSION,
  appVersion: "0.0.1",
  channel: "stable",
  health: { db: true, api: true, storefront: true },
  usage: { orgs: 1, sites: 2, seats: 1, storageMB: 12 },
  orgs: [{ id: "local-org", name: "HM Froid" }],
};
const raw = JSON.stringify(hb);
const ts = Math.floor(Date.now() / 1000);
const sign = async (body: string) => Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(signingPayload(ts, body)))).toString("base64url");
const send = async (body: string, sig: string) => fetch(`${API}/v1/heartbeat`, {
  method: "POST",
  headers: { "content-type": "application/json", [SIGNATURE_HEADERS.instance]: regBody.instanceId, [SIGNATURE_HEADERS.timestamp]: String(ts), [SIGNATURE_HEADERS.signature]: sig },
  body,
});
const tampered = await send(raw.replace('"sites":2', '"sites":1'), await sign(raw));
if (tampered.status !== 401) die(`tampered body should be 401, got ${tampered.status}`);
ok("tampered heartbeat rejected");
const res = await send(raw, await sign(raw));
const hbRes = HeartbeatResponse.parse(await res.json());
const licenseToken = hbRes.licenseToken ?? die("no licence in heartbeat response");
ok(`heartbeat ${res.status}${hbRes.release ? `, update offered: ${hbRes.release.version}` : ""}`);

const { payload, protectedHeader } = await jwtVerify(licenseToken, createRemoteJWKSet(new URL(regBody.jwksUrl)));
const claims = LicenseClaims.parse(payload);
if (claims.sub !== regBody.instanceId || claims.organizationId !== org.id) die("licence claims mismatch", claims);
ok(`licence verified via JWKS (kid ${protectedHeader.kid}): plan=${claims.plan} instances≤${claims.limits.instances}`);

const overview = await portal(`/api/v1/orgs/${org.id}/overview`);
if (overview.instances[0]?.lastSeenAt == null) die("overview missing heartbeat", overview);
ok("portal overview shows the instance as seen");
