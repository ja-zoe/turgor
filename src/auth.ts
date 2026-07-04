import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyHandoffToken } from "@/lib/handoff-token";
import { isEmailDomainAllowed } from "@/lib/auth-provider";
import { UserStatus } from "@/generated/prisma";
import { notifyNewSignup } from "@/lib/notifications";
import authConfig from "./auth.config";

/**
 * The built-in Project Manager role, by its stable key — the display name is
 * PM-editable, so never look it up by name. The name fallback covers a DB that
 * predates the builtInKey backfill.
 */
async function findPmRoleId(): Promise<string | null> {
  const byKey = await prisma.role.findUnique({
    where: { builtInKey: "pm" },
    select: { id: true },
  });
  if (byKey) return byKey.id;
  const byName = await prisma.role.findFirst({
    where: { name: "Project Manager" },
    select: { id: true },
  });
  return byName?.id ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as Parameters<typeof PrismaAdapter>[0]),
  providers: [
    Credentials({
      credentials: { token: { type: "text" } },
      async authorize(credentials, _request) {
        const raw = credentials?.token;
        if (typeof raw !== "string") return null;

        const identity = verifyHandoffToken(raw);
        if (!identity) return null;

        // R33.1: every handoff token now carries a full verified email — the magic
        // link, the OAuth callbacks (R33.2), and the dev mock all mint email tokens.
        // A token without "@" is malformed (the old CAS/netId path is gone) → reject.
        if (!identity.includes("@")) return null;
        const email = identity.toLowerCase();
        const netId = email.split("@")[0];
        if (!isEmailDomainAllowed(email)) return null;

        // Find or create the user
        let user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, status: true, roleId: true },
        });

        if (!user) {
          const isPM = email === process.env.PM_ADMIN_EMAIL;
          const roleId = isPM ? await findPmRoleId() : null;

          user = await prisma.user.create({
            data: {
              email,
              name: netId,
              status: isPM ? UserStatus.ACTIVE : UserStatus.PENDING,
              roleId,
            },
            select: { id: true, email: true, name: true, status: true, roleId: true },
          });

          if (user.status === UserStatus.PENDING) {
            try {
              await notifyNewSignup({ id: user.id, name: user.name, email: user.email });
            } catch (e) {
              console.error("signup notify failed", e);
            }
          }
        } else if (
          user.status === UserStatus.PENDING &&
          email === process.env.PM_ADMIN_EMAIL
        ) {
          // PM signed in before seed ran — activate them now
          const pmRoleId = await findPmRoleId();
          user = await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE, roleId: pmRoleId ?? user.roleId },
            select: { id: true, email: true, name: true, status: true, roleId: true },
          });
        } else if (
          user.status === UserStatus.SUSPENDED ||
          user.status === UserStatus.DELETED
        ) {
          // SUSPENDED and DELETED accounts can't sign in. (A deleted user's email was
          // rewritten, so a returning netId is normally provisioned fresh as PENDING above.)
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? netId,
          status: user.status,
          roleId: user.roleId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.status = user.status;
        token.roleId = user.roleId ?? null;

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id! },
          select: { firstName: true, nickname: true },
        });
        token.firstName = dbUser?.firstName ?? null;
        token.nickname = dbUser?.nickname ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.status = token.status;
      session.user.roleId = token.roleId;
      session.user.firstName = token.firstName;
      session.user.nickname = token.nickname;
      return session;
    },
  },
});
