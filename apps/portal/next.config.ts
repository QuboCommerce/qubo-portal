import type { NextConfig } from "next";

// Hosts allowed to load dev assets/HMR (set by scripts/dev/qd).
const devOrigins = (process.env.QUBO_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
const api = process.env.PORTAL_API_INTERNAL_URL ?? "http://127.0.0.1:3340";

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  output: "standalone",
  transpilePackages: ["@qubo-portal/plans"],
  // Same-origin proxy: auth cookies stay host-only on the portal host.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${api}/api/auth/:path*` },
      { source: "/api/v1/:path*", destination: `${api}/v1/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
