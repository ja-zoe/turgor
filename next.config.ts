import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Logo uploads (R29.1) allow images up to 2 MB; the framework default of
      // 1 MB would reject them before our own validation runs.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
