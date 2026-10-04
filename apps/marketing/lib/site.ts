// Read at request time (server components only) so one image serves any domain.
export const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const portalUrl = () => (process.env.PORTAL_URL ?? "http://localhost:3001").replace(/\/$/, "");
