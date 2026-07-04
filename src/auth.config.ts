import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Node.js-only modules). Used by middleware.
// The full config (with Prisma adapter + Credentials provider) is in auth.ts.
const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  pages: {
    // R33.1/R33.2: the sign-in surface is /signin/email (dev-login 404s in prod).
    // OAuth errors (e.g. AccessDenied from the signIn callback) land here too.
    signIn: "/signin/email",
    error: "/signin/email",
  },
};

export default authConfig;
