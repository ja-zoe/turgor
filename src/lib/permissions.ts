import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Permission, UserStatus } from "@/generated/prisma";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  status: UserStatus;
  roleId: string | null;
};

/** Returns the session user or redirects. Does NOT check permissions. */
export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/cas/login");
  if (session.user.status === UserStatus.PENDING) redirect("/pending");
  if (session.user.status === UserStatus.SUSPENDED) redirect("/api/cas/login");
  return session.user as SessionUser;
}

/** Returns the role's permission array for the given user. */
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
