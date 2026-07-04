import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
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

/** Promote a user to the built-in PM role + ACTIVE. Idempotent. */
async function promotePmToActive(userId: string): Promise<void> {
  const pmRoleId = await findPmRoleId();
  if (pmRoleId) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, roleId: pmRoleId },
    });
  }
}

/**
 * The two first-sign-in side effects, shared by every provisioning path so they
 * can't drift (magic link + dev mock create the user in `authorize`; OAuth creates
 * it via the adapter and calls this from `events.createUser`): the configured PM
 * email is auto-promoted to Project Manager + ACTIVE; everyone else stays PENDING
 * and triggers a new-signup notification.
 */
async function finalizeNewUser(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  if (user.email === process.env.PM_ADMIN_EMAIL) {
    await promotePmToActive(user.id);
    return;
  }
  try {
    await notifyNewSignup({ id: user.id, name: user.name, email: user.email });
  } catch (e) {
    console.error("signup notify failed", e);
  }
}

// R33.2: Google/GitHub join the provider list only when their credential pair is
// present (NextAuth's default AUTH_GOOGLE_*/AUTH_GITHUB_* env names → zero-arg
// config). allowDangerousEmailAccountLinking lets an existing magic-link user sign
// in via OAuth with the same verified email and reach the same account, instead of
// dead-ending on OAuthAccountNotLinked — email is the identity key across all paths.
const oauthProviders = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(GitHub({ allowDangerousEmailAccountLinking: true }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as Parameters<typeof PrismaAdapter>[0]),
  events: {
    // Adapter-created users are OAuth-only (Credentials creates its own row in
    // authorize). Mirror the magic-link side effects here so both paths converge.
    async createUser({ user }) {
      if (user.id && user.email) {
        await finalizeNewUser({ id: user.id, email: user.email, name: user.name ?? null });
      }
    },
  },
  providers: [
    ...oauthProviders,
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

        let user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, status: true },
        });

        // SUSPENDED and DELETED accounts can't sign in.
        if (user && (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED)) {
          return null;
        }

        if (!user) {
          // New users start PENDING; finalizeNewUser promotes the PM or notifies.
          user = await prisma.user.create({
            data: { email, name: netId, status: UserStatus.PENDING, roleId: null },
            select: { id: true, email: true, name: true, status: true },
          });
          await finalizeNewUser(user);
        } else if (email === process.env.PM_ADMIN_EMAIL && user.status === UserStatus.PENDING) {
          // Existing PM who signed in before the seed ran — activate now.
          await promotePmToActive(user.id);
        }

        // Re-read after any promotion so the returned user carries the final
        // status/roleId (the jwt callback also reads the DB, for OAuth parity).
        const finalUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true, name: true, status: true, roleId: true },
        });
        if (!finalUser) return null;
        return {
          id: user.id,
          email: finalUser.email,
          name: finalUser.name ?? netId,
          status: finalUser.status,
          roleId: finalUser.roleId,
        };
      },
    }),
  ],
  callbacks: {
    // R33.2: gate OAuth sign-ins the same way authorize gates the Credentials path.
    async signIn({ account, profile, user }) {
      if (!account || account.provider === "credentials") return true;
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      if (!email || !isEmailDomainAllowed(email)) return false; // → ?error=AccessDenied
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { status: true },
      });
      if (
        existing &&
        (existing.status === UserStatus.SUSPENDED || existing.status === UserStatus.DELETED)
      ) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        // Authoritative read: covers OAuth users promoted in events.createUser
        // (which runs after `user` is captured) and keeps status/role fresh.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id! },
          select: { status: true, roleId: true, firstName: true, nickname: true },
        });
        token.status = dbUser?.status ?? UserStatus.PENDING;
        token.roleId = dbUser?.roleId ?? null;
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
