import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Node.js-only modules). Used by middleware.
// The full config (with Prisma adapter + Credentials provider) is in auth.ts.
const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  pages: {
    signIn: "/dev-login",
    error: "/dev-login",
  },
};

export default authConfig;
