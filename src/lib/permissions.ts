import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { Permission, UserStatus } from "@/generated/prisma";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  /** Active org (R35.2). */
  orgId: string;
  /** Status of the active-org membership. */
  status: UserStatus;
  /** Role of the active-org membership. */
  roleId: string | null;
};

/**
 * Retired permissions: still present in the Postgres enum (values can't be dropped
 * without a table rewrite) but read by no gate and hidden from the Role Builder.
 * parsePermissions in roles.ts strips them on every save.
 */
export const RETIRED_PERMISSIONS: readonly Permission[] = [Permission.VIEW_ASSIGNED_PROJECTS];

/**
 * Returns the session user scoped to their active org, or redirects. Role and
 * status come from the active-org membership (R35.2), not the JWT. Does NOT check
 * permissions.
 */
export async function requireAuth(): Promise<SessionUser> {
  const ctx = await getTenantContext(); // redirects if no session / no membership
  const status = ctx.membership.status;
  if (status === UserStatus.PENDING) redirect("/pending");
  if (status === UserStatus.SUSPENDED) redirect("/signin");
  // A DELETED membership is treated as inactive — locked out (R18.2).
  if (status === UserStatus.DELETED) redirect("/signin");
  return {
    id: ctx.userId,
    email: ctx.email,
    name: ctx.name,
    orgId: ctx.orgId,
    status,
    roleId: ctx.membership.roleId,
  };
}

/** Returns the role's permission array for the given role id. */
export async function getUserPermissions(roleId: string | null): Promise<Permission[]> {
  if (!roleId) return [];
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { permissions: true },
  });
  return role?.permissions ?? [];
}

/** Checks a single permission, redirecting to /dashboard if not granted. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAuth();
  const perms = await getUserPermissions(user.roleId);
  if (!perms.includes(permission)) redirect("/dashboard");
  return user;
}

/** Returns true if the user has the given permission (no redirect). */
export async function hasPermission(
  roleId: string | null,
  permission: Permission
): Promise<boolean> {
  const perms = await getUserPermissions(roleId);
  return perms.includes(permission);
}

/** Returns the user's ProjectAssignment role for a specific project, or null. */
export async function getProjectMembership(userId: string, projectId: string) {
  return prisma.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
}
