// Prints a fresh Ed25519 signing key for PORTAL_SIGNING_KEYS.
// Rotation: prepend the new key to the existing array, keep the old one until issued tokens expire (30 d + 7 d grace).
import { newSigningJwk } from "../src/lib/keys";

const jwk = await newSigningJwk();
console.log(`PORTAL_SIGNING_KEYS='${JSON.stringify([jwk])}'`);
