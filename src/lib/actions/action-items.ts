"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requirePermission, getProjectMembership } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createActionItem(projectId: string, formData: FormData) {
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, projectId);
  // Requires either project membership (lead/sublead) or PM permission
  if (!membership || membership.role === "MEMBER") {
    await requirePermission(Permission.ASSIGN_ACTION_ITEMS);
  }

  const description = (formData.get("description") as string).trim();
  const ownerId = (formData.get("ownerId") as string | null) || null;
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  const meetingId = (formData.get("meetingId") as string | null) || null;

  if (!description) throw new Error("Description is required");

  await prisma.actionItem.create({
    data: {
      projectId,
      description,
      ownerId: ownerId || null,
      deadline,
      meetingId: meetingId || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function closeActionItem(actionItemId: string) {
  const user = await requireAuth();

  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { projectId: true, ownerId: true },
  });

  // Owner can always close their own item; others need CLOSE_ACTION_ITEMS
  if (item.ownerId !== user.id) {
    await requirePermission(Permission.CLOSE_ACTION_ITEMS);
  }

  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { status: "DONE", completedAt: new Date() },
  });

  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/action-items");
}

export async function reopenActionItem(actionItemId: string) {
  await requirePermission(Permission.CLOSE_ACTION_ITEMS);

  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { projectId: true },
  });

  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { status: "OPEN", completedAt: null },
  });

  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/action-items");
}

export async function updateActionItem(actionItemId: string, formData: FormData) {
  const user = await requireAuth();

  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { projectId: true, ownerId: true },
  });

  const membership = await getProjectMembership(user.id, item.projectId);
  if (!membership || membership.role === "MEMBER") {
    await requirePermission(Permission.ASSIGN_ACTION_ITEMS);
  }

  const description = (formData.get("description") as string).trim();
  const ownerId = (formData.get("ownerId") as string | null) || null;
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  if (!description) throw new Error("Description is required");

  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { description, ownerId: ownerId || null, deadline },
  });

  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/action-items");
  redirect(`/projects/${item.projectId}`);
}

/** Marks all OPEN action items on a project as carriedOver = true. */
export async function carryOverActionItems(projectId: string) {
  await prisma.actionItem.updateMany({
    where: { projectId, status: "OPEN" },
    data: { carriedOver: true },
  });
}
