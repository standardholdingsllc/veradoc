import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy bundles do not receive arbitrary runtime environment variables under
  // `next start`. Make the non-secret rollout gate an explicit build setting.
  env: {
    HOST_ROUTING_MODE: process.env.HOST_ROUTING_MODE ?? "off",
  },
  experimental: {
    serverActions: {
      // Required for notarial scan uploads (up to 50 MB).
      // Note: Vercel Pro allows 50 MB; Hobby allows 4.5 MB.
      // If platform limit is lower, migrate to direct-to-Storage presigned URL uploads.
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
