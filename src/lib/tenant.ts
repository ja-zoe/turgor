import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { forOrg, ACTIVE_ORG_COOKIE, ACTIVE_ORG_SLUG_HEADER } from "@/lib/tenant-db";
import type { UserStatus } from "@/generated/prisma";

/**
 * Request-scoped tenancy (R35.2). Resolves the active org from the
 * `turgor-active-org` cookie (validated against the user's memberships) and
 * exposes the scoped client for it. The low-level `forOrg` client lives in
 * `tenant-db.ts` (auth-free) to keep the import graph acyclic.
 *
 * The active org is NOT stored in the JWT: a user can belong to many orgs and
 * switch between them, and re-minting the JWT on every switch invites stale-role
 * bugs. The cookie is the selection; membership is the authority.
 */

export { forOrg, ACTIVE_ORG_COOKIE, DEFAULT_ORG_ID } from "@/lib/tenant-db";

export type ActiveMembership = {
  id: string;
  orgId: string;
  slug: string;
  roleId: string | null;
  status: UserStatus;
};

export type TenantContext = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  /** The membership for the active org (source of the per-org role + status). */
  membership: ActiveMembership;
  /** All of the user's memberships (for the org switcher). */
  memberships: ActiveMembership[];
};

async function loadMemberships(userId: string): Promise<ActiveMembership[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, orgId: true, roleId: true, status: true, org: { select: { slug: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    orgId: m.orgId,
    slug: m.org.slug,
    roleId: m.roleId,
    status: m.status,
  }));
}

/**
 * Resolve the active membership by precedence (R38): injected slug header (a subdomain the
 * user is a member of) → cookie orgId (the in-app switcher) → first ACTIVE → first. A
 * header/cookie value the user isn't a member of is ignored, so resolution only ever picks
 * one of the user's own orgs.
 */
function pickActive(
  memberships: ActiveMembership[],
  slug: string | undefined,
  cookieOrgId: string | undefined,
): ActiveMembership {
  return (
    (slug ? memberships.find((m) => m.slug === slug) : undefined) ??
    (cookieOrgId ? memberships.find((m) => m.orgId === cookieOrgId) : undefined) ??
    memberships.find((m) => m.status === "ACTIVE") ??
    memberships[0]
  );
}

/**
 * The authenticated request's tenant context. Redirects to /signin when there is
 * no session and to /pending when the user has no membership yet. Cached per
 * request. This does NOT enforce that the active membership is ACTIVE — that gate
 * lives in requireAuth (permissions.ts), so resolution still works for a PENDING
 * member (e.g. to render /pending or list their orgs).
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const memberships = await loadMemberships(userId);
  if (memberships.length === 0) redirect("/pending");
  const slug = (await headers()).get(ACTIVE_ORG_SLUG_HEADER) ?? undefined;
  // R39.2: on Cloud, a subdomain the user isn't a member of must not silently show their
  // primary org — send them to the picker. Inert on self-host (no header, env unset).
  if (slug && !memberships.some((m) => m.slug === slug) && process.env.FOREIGN_ORG_REDIRECT) {
    redirect(process.env.FOREIGN_ORG_REDIRECT);
  }
  const cookieOrgId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const membership = pickActive(memberships, slug, cookieOrgId);
  return {
    userId,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    orgId: membership.orgId,
    membership,
    memberships,
  };
});

/** Scoped client for the active org. */
export async function tenantDb() {
  const { orgId } = await getTenantContext();
  return forOrg(orgId);
}

/**
 * Non-redirecting active-org resolution for API route handlers (which return their
 * own 401 rather than redirect). Returns null when unauthenticated or the user has
 * no membership. Same cookie→primary-membership logic as getTenantContext; also
 * surfaces the active membership's roleId/status so route handlers can gate.
 */
export async function resolveActiveOrg(): Promise<{
  userId: string;
  orgId: string;
  roleId: string | null;
  status: UserStatus;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const memberships = await loadMemberships(userId);
  if (memberships.length === 0) return null;
  const slug = (await headers()).get(ACTIVE_ORG_SLUG_HEADER) ?? undefined;
  const cookieOrgId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const m = pickActive(memberships, slug, cookieOrgId);
  return { userId, orgId: m.orgId, roleId: m.roleId, status: m.status };
}
