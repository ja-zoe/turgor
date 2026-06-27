import type { UserStatus } from "@/generated/prisma";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    status: UserStatus;
    roleId: string | null;
    firstName?: string | null;
    nickname?: string | null;
  }
  interface Session {
    user: {
      id: string;
      status: UserStatus;
      roleId: string | null;
      firstName: string | null;
      nickname: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    status: UserStatus;
    roleId: string | null;
    firstName: string | null;
    nickname: string | null;
  }
}
