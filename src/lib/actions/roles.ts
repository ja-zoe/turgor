"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, RETIRED_PERMISSIONS } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Excluding retired values here both hides them from grantability and strips them
// defensively from any submitted form.
const ALL_PERMISSIONS = Object.values(Permission).filter(
  (p) => !RETIRED_PERMISSIONS.includes(p)
);

function parsePermissions(formData: FormData): Permission[] {
  return ALL_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on");
}

export async function createRole(formData: FormData) {
  await requirePermission(Permission.MANAGE_ROLES);

  const name = (formData.get("name") as string).trim();
  if (!name) throw new Error("Name is required");

  const permissions = parsePermissions(formData);

  const role = await prisma.role.create({ data: { name, permissions } });
  revalidatePath("/pm/users");
  redirect(`/pm/users?role=${role.id}`);
}

export async function updateRole(roleId: string, formData: FormData) {
  const me = await requirePermission(Permission.MANAGE_ROLES);

  const name = (formData.get("name") as string).trim();
  const permissions = parsePermissions(formData);

  // Self-lockout guard: removing MANAGE_ROLES from your own role leaves no in-app
  // path back into the Role Builder. Strictly self-referential — editing someone
  // else's role (even another PM role) stays unrestricted.
  if (me.roleId === roleId && !permissions.includes(Permission.MANAGE_ROLES)) {
    throw new Error("You cannot remove Manage roles from your own role (self-lockout).");
  }

  // Never-blank: an emptied name keeps the current one (same idiom as updateOrgSettings).
  await prisma.role.update({
    where: { id: roleId },
    data: { ...(name ? { name } : {}), permissions },
  });
  revalidatePath("/pm/users");
}

export async function deleteRole(roleId: string) {
  const me = await requirePermission(Permission.MANAGE_ROLES);

  // Deleting your own role nulls your roleId (users are unassigned below) — the
  // same self-lockout as stripping MANAGE_ROLES.
  if (me.roleId === roleId) throw new Error("You cannot delete your own role.");

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.isBuiltIn) throw new Error("Cannot delete a built-in role");

  // Unassign users from this role before deleting
  await prisma.user.updateMany({ where: { roleId }, data: { roleId: null } });
  await prisma.role.delete({ where: { id: roleId } });

  revalidatePath("/pm/users");
}
