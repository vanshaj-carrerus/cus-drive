import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs", "cloudinary"],
  agentRules: false,
  allowedDevOrigins: ["192.168.1.56", "127.0.0.1", "localhost"],
  experimental: {
    proxyClientMaxBodySize: "30mb",
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
