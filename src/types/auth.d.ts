import type { UserStatus } from "@/generated/prisma";
import "next-auth";
import "next-auth/jwt";

// R35.2: role + activation are per-org (Membership), not global. The JWT/session
// keep only a COARSE derived `status` (ACTIVE when the user has any ACTIVE
// membership) so the edge middleware can gate app access without a DB read. The
// active org's role/status are resolved per request via getTenantContext.
declare module "next-auth" {
  interface User {
    firstName?: string | null;
    nickname?: string | null;
  }
  interface Session {
    user: {
      id: string;
      status: UserStatus;
      firstName: string | null;
      nickname: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    status: UserStatus;
    firstName: string | null;
    nickname: string | null;
  }
}
