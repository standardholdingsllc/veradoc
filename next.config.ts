import type { NextConfig } from "next";

const productionSurfaceOrigins = [
  ["veradoc.pe", "https://veradoc.pe"],
  ["www.veradoc.pe", "https://www.veradoc.pe"],
  ["app.veradoc.pe", "https://app.veradoc.pe"],
  ["notario.veradoc.pe", "https://notario.veradoc.pe"],
  ["admin.veradoc.pe", "https://admin.veradoc.pe"],
  ["demo.veradoc.pe", "https://demo.veradoc.pe"],
] as const;

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
  async headers() {
    // Vercel adds ACAO=* to cached static output. Override that platform
    // default with each surface's own origin. This is intentionally
    // equivalent to same-origin access and does not authorize cross-host
    // browser reads between VeraDoc surfaces.
    return productionSurfaceOrigins.map(([host, origin]) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      headers: [{ key: "Access-Control-Allow-Origin", value: origin }],
    }));
  },
};

export default nextConfig;
