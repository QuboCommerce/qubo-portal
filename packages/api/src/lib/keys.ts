import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Ed25519 signing keys for licences and impersonation grants.
 * Prod: PORTAL_SIGNING_KEYS = JSON array of private JWKs (with kid); the first
 * one signs, all are published in the JWKS (rotation = prepend a new key, drop
 * the old one after the longest token lifetime). Dev: generated once into
 * .qubo/signing-keys.json at the repo root.
 */
const DEV_FILE = resolve(import.meta.dir, "../../../../.qubo/signing-keys.json");

export async function newSigningJwk(): Promise<JWK> {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const jwk = await exportJWK(privateKey);
  return { ...jwk, kid: `k${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`, alg: "EdDSA", use: "sig" };
}

async function loadPrivateJwks(): Promise<JWK[]> {
  const env = process.env.PORTAL_SIGNING_KEYS;
  if (env) return JSON.parse(env);
  if (process.env.NODE_ENV === "production") throw new Error("PORTAL_SIGNING_KEYS is required in production (pnpm keys:generate)");
  if (existsSync(DEV_FILE)) return JSON.parse(readFileSync(DEV_FILE, "utf8"));
  const keys = [await newSigningJwk()];
  mkdirSync(dirname(DEV_FILE), { recursive: true });
  writeFileSync(DEV_FILE, JSON.stringify(keys), { mode: 0o600 });
  console.log(`[portal-api] generated dev signing key ${keys[0].kid} → .qubo/signing-keys.json`);
  return keys;
}

let cache: Promise<{ jwks: { keys: JWK[] }; sign: (claims: Record<string, unknown>, exp: number) => Promise<string> }> | null = null;

export function signer() {
  cache ??= (async () => {
    const priv = await loadPrivateJwks();
    if (!priv.length || priv.some((k) => !k.kid || k.crv !== "Ed25519" || !k.d)) throw new Error("signing keys must be Ed25519 private JWKs with a kid");
    const publicKeys = priv.map(({ d: _d, ...pub }) => pub);
    const current = priv[0];
    const key = await importJWK(current, "EdDSA");
    return {
      jwks: { keys: publicKeys },
      sign: (claims, exp) =>
        new SignJWT(claims).setProtectedHeader({ alg: "EdDSA", kid: current.kid, typ: "JWT" }).setIssuedAt().setExpirationTime(exp).sign(key),
    };
  })();
  return cache;
}
