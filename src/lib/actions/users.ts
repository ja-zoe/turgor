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

/**
 * Anonymizing soft-delete (R18.2). We never hard-delete — that would orphan/destroy authored
 * history (StatusUpdates, MeetingRecords, owned ActionItems, assigned Subtasks). Instead we
 * mark the user DELETED and scrub PII, keeping all FKs/history intact. A PM can NEVER delete
 * themselves (hard guard). The rewritten unique email frees the netId to re-register later.
 */
export async function deleteUser(userId: string) {
  const me = await requirePermission(Permission.DELETE_USERS);

  // Hard guard: never self-delete.
  if (me.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  // Anonymize + soft-delete in one update.
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DELETED",
      name: "Deleted user",
      firstName: null,
      lastName: null,
      nickname: null,
      // Unique placeholder so the original netId can re-register and the @unique holds.
      email: `deleted+${userId}@seed.invalid`,
      mcpToken: null,
      image: null,
    },
  });

  // Revoke access: sessions + accounts (force logout), project assignments (drop access),
  // and any recorded MCP connections (token is now null). History links are kept.
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.projectAssignment.deleteMany({ where: { userId } });
  await prisma.mcpConnection.deleteMany({ where: { userId } });

  revalidatePath("/pm/users");
}
