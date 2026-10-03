const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export const randomToken = (prefix: string, bytes = 24) => `${prefix}_${b64url(crypto.getRandomValues(new Uint8Array(bytes)))}`;

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(digest).toString("hex");
}

/** Verifies an Ed25519 signature; both key and signature are base64url. */
export async function verifyEd25519(publicKeyB64: string, signatureB64: string, message: string) {
  try {
    const key = await crypto.subtle.importKey("raw", Buffer.from(publicKeyB64, "base64url"), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, Buffer.from(signatureB64, "base64url"), new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

/** Compares x.y.z versions numerically; pre-release suffixes sort before the release. */
export function compareVersions(a: string, b: string) {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, "").split("-", 2);
    return { nums: core.split(".").map((n) => Number(n) || 0), pre };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}
