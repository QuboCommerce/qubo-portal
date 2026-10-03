import { app } from "./index";

const port = Number(process.env.PORT ?? 3340);
// qd sets HOST=127.0.0.1 so dev servers are only reachable through the edge proxy.
const hostname = process.env.HOST ?? "0.0.0.0";

app.listen({ port, hostname }, () => {
  console.log(`[portal-api] listening on ${hostname}:${port}`);
});
