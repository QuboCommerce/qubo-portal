import type { NextConfig } from "next";

const devOrigins = (process.env.QUBO_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  output: "standalone",
  transpilePackages: ["@qubo-portal/plans", "@qubo/protocol"],
};

export default nextConfig;
