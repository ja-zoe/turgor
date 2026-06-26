"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

export async function approveUser(userId: string, roleId: string) {
  await requirePermission(Permission.MANAGE_USERS);

  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", roleId },
  });

  // In-app notification to the user
  await prisma.notification.create({
    data: {
      userId,
      type: "USER_APPROVAL",
      title: "Your account has been approved",
      body: "You now have access to the SEED Project Tracker.",
      link: "/dashboard",
    },
  });

  revalidatePath("/pm/users");
}

export async function updateUserRole(userId: string, roleId: string) {
  await requirePermission(Permission.MANAGE_USERS);
  await prisma.user.update({ where: { id: userId }, data: { roleId } });
  revalidatePath("/pm/users");
}

export async function suspendUser(userId: string) {
  await requirePermission(Permission.MANAGE_USERS);
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  revalidatePath("/pm/users");
}

export async function reactivateUser(userId: string) {
  await requirePermission(Permission.MANAGE_USERS);
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  revalidatePath("/pm/users");
}
