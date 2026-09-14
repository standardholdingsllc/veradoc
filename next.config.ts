import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
