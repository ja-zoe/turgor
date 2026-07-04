import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @phosphor-icons/react is a barrel of ~3000 icons (41 MB). Without this, a
    // single `import { Leaf } from "@phosphor-icons/react"` makes the dev compiler
    // (Turbopack) pull in the ENTIRE barrel on first load of any route that uses an
    // icon — which hangs `○ Compiling …` and spikes CPU/RAM until the machine
    // thrashes. This rewrites barrel imports to per-icon deep imports so only the
    // handful actually used get compiled. Icons are imported in ~38 files, so this
    // affects nearly every route. (Production `next build` already tree-shakes.)
    optimizePackageImports: ["@phosphor-icons/react"],
    serverActions: {
      // Logo uploads (R29.1) allow images up to 2 MB; the framework default of
      // 1 MB would reject them before our own validation runs.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
