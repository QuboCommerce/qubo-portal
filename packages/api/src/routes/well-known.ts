import { Elysia } from "elysia";
import { signer } from "../lib/keys";

export const wellKnown = new Elysia().get("/.well-known/jwks.json", async ({ set }) => {
  set.headers["cache-control"] = "public, max-age=3600";
  return (await signer()).jwks;
});
