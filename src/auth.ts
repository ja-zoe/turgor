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
import { ensureMembership, getOrgRoleId, resolveSignupOrgId } from "@/lib/provisioning";
import authConfig from "./auth.config";

/**
 * Coarse cross-org status for the JWT/edge middleware: ACTIVE if the user is
 * ACTIVE in any org, else PENDING/SUSPENDED, else PENDING (no membership yet). The
 * per-org active status is resolved in-app via getTenantContext.
 */
async function coarseStatus(userId: string): Promise<UserStatus> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { status: true },
  });
  if (memberships.some((m) => m.status === UserStatus.ACTIVE)) return UserStatus.ACTIVE;
  if (memberships.some((m) => m.status === UserStatus.PENDING)) return UserStatus.PENDING;
  if (memberships.some((m) => m.status === UserStatus.SUSPENDED)) return UserStatus.SUSPENDED;
  return UserStatus.PENDING;
}

/** Promote a user to an ACTIVE Project Manager membership in an org. Idempotent. */
async function promotePmToActive(userId: string, orgId: string): Promise<void> {
  const pmRoleId = await getOrgRoleId(orgId, "pm");
  await ensureMembership(userId, orgId, { status: UserStatus.ACTIVE, roleId: pmRoleId });
}

/**
 * The first-sign-in side effects, shared by every provisioning path so they can't
 * drift (magic link + dev mock create the user in `authorize`; OAuth creates it via
 * the adapter and calls this from `events.createUser`): the user joins their signup
 * org; the configured PM email is auto-promoted to an ACTIVE Project Manager
 * membership, everyone else gets a PENDING membership and triggers a new-signup
 * notification.
 */
async function finalizeNewUser(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const orgId = await resolveSignupOrgId(user.email);
  if (user.email === process.env.PM_ADMIN_EMAIL) {
    await promotePmToActive(user.id, orgId);
    return;
  }
  await ensureMembership(user.id, orgId, { status: UserStatus.PENDING });
  try {
    await notifyNewSignup({ id: user.id, name: user.name, email: user.email }, orgId);
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
          select: { id: true, email: true, name: true },
        });

        if (!user) {
          // New users get a PENDING membership; finalizeNewUser promotes the PM.
          user = await prisma.user.create({
            data: { email, name: netId },
            select: { id: true, email: true, name: true },
          });
          await finalizeNewUser(user);
        } else if (email === process.env.PM_ADMIN_EMAIL) {
          // Existing PM who signed in before the seed ran — ensure an ACTIVE PM
          // membership in their signup org. Idempotent.
          const orgId = await resolveSignupOrgId(email);
          await promotePmToActive(user.id, orgId);
        }

        // Authentication is global identity; per-org access is gated in-app. Block
        // sign-in only when the user is SUSPENDED/DELETED in every org they belong
        // to (no path back in). A user with any usable membership may authenticate.
        const memberships = await prisma.membership.findMany({
          where: { userId: user.id },
          select: { status: true },
        });
        const locked =
          memberships.length > 0 &&
          memberships.every(
            (m) => m.status === UserStatus.SUSPENDED || m.status === UserStatus.DELETED,
          );
        if (locked) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? netId,
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
        select: { id: true },
      });
      if (existing) {
        const memberships = await prisma.membership.findMany({
          where: { userId: existing.id },
          select: { status: true },
        });
        const locked =
          memberships.length > 0 &&
          memberships.every(
            (m) => m.status === UserStatus.SUSPENDED || m.status === UserStatus.DELETED,
          );
        if (locked) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        // Authoritative read: covers OAuth users provisioned in events.createUser
        // (which runs after `user` is captured) and keeps the coarse status fresh.
        const [status, dbUser] = await Promise.all([
          coarseStatus(user.id!),
          prisma.user.findUnique({
            where: { id: user.id! },
            select: { firstName: true, nickname: true },
          }),
        ]);
        token.status = status;
        token.firstName = dbUser?.firstName ?? null;
        token.nickname = dbUser?.nickname ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.status = token.status;
      session.user.firstName = token.firstName;
      session.user.nickname = token.nickname;
      return session;
    },
  },
});
