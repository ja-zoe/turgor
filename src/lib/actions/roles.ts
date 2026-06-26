"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ALL_PERMISSIONS = Object.values(Permission);

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
  await requirePermission(Permission.MANAGE_ROLES);

  const name = (formData.get("name") as string).trim();
  const permissions = parsePermissions(formData);

  await prisma.role.update({ where: { id: roleId }, data: { name, permissions } });
  revalidatePath("/pm/users");
}

export async function deleteRole(roleId: string) {
  await requirePermission(Permission.MANAGE_ROLES);

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.isBuiltIn) throw new Error("Cannot delete a built-in role");

  // Unassign users from this role before deleting
  await prisma.user.updateMany({ where: { roleId }, data: { roleId: null } });
  await prisma.role.delete({ where: { id: roleId } });

  revalidatePath("/pm/users");
}
