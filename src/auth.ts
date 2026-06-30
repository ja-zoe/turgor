import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyHandoffToken } from "@/lib/handoff-token";
import { UserStatus } from "@/generated/prisma";
import { notifyNewSignup } from "@/lib/notifications";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as Parameters<typeof PrismaAdapter>[0]),
  providers: [
    Credentials({
      credentials: { token: { type: "text" } },
      async authorize(credentials, _request) {
        const raw = credentials?.token;
        if (typeof raw !== "string") return null;

        const netId = verifyHandoffToken(raw);
        if (!netId) return null;

        const emailDomain = process.env.CAS_EMAIL_DOMAIN ?? "scarletmail.rutgers.edu";
        const email = `${netId}@${emailDomain}`;

        const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
          .split(",")
          .map((d) => d.trim());
        if (!allowed.includes(emailDomain)) return null;

        // Find or create the user
        let user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, status: true, roleId: true },
        });

        if (!user) {
          const isPM = email === process.env.PM_ADMIN_EMAIL;
          let roleId: string | null = null;

          if (isPM) {
            const pmRole = await prisma.role.findFirst({
              where: { name: "Project Manager" },
              select: { id: true },
            });
            roleId = pmRole?.id ?? null;
          }

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
          const pmRole = await prisma.role.findFirst({
            where: { name: "Project Manager" },
            select: { id: true },
          });
          user = await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE, roleId: pmRole?.id ?? user.roleId },
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
