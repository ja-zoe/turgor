import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forOrg, ACTIVE_ORG_COOKIE } from "@/lib/tenant-db";
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
  return prisma.membership.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, orgId: true, roleId: true, status: true },
  });
}

function pickActive(
  memberships: ActiveMembership[],
  wanted: string | undefined,
): ActiveMembership {
  return (
    (wanted ? memberships.find((m) => m.orgId === wanted) : undefined) ??
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
  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const membership = pickActive(memberships, wanted);
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
  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const m = pickActive(memberships, wanted);
  return { userId, orgId: m.orgId, roleId: m.roleId, status: m.status };
}
