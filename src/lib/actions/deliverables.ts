"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, getProjectMembership } from "@/lib/permissions";
import { Permission, TimelineStatus } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDeliverable(projectId: string, formData: FormData) {
  await requirePermission(Permission.MANAGE_MILESTONES);

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const targetDate = new Date(formData.get("targetDate") as string);
  const startDateRaw = formData.get("startDate") as string | null;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;

  if (!title) throw new Error("Title is required");

  const count = await prisma.deliverable.count({ where: { projectId } });

  await prisma.deliverable.create({
    data: {
      projectId,
      title,
      description,
      targetDate,
      startDate,
      orderIndex: count,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDeliverable(deliverableId: string, formData: FormData) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  const canManage =
    membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  // PM permission checked separately — if no membership, need MANAGE_MILESTONES
  if (!canManage) await requirePermission(Permission.MANAGE_MILESTONES);

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const targetDate = new Date(formData.get("targetDate") as string);
  const startDateRaw = formData.get("startDate") as string | null;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const status = (formData.get("status") as TimelineStatus) ?? TimelineStatus.NOT_STARTED;
  const completed = status === TimelineStatus.COMPLETE;

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      title,
      description,
      targetDate,
      startDate,
      status,
      completed,
      completedDate: completed ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
  redirect(`/projects/${deliverable.projectId}`);
}

export async function deleteDeliverable(deliverableId: string) {
  await requirePermission(Permission.MANAGE_MILESTONES);

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  await prisma.deliverable.delete({ where: { id: deliverableId } });

  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function createSubtask(deliverableId: string, formData: FormData) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  const assigneeId = (formData.get("assigneeId") as string | null) || null;

  const count = await prisma.subtask.count({ where: { deliverableId } });

  await prisma.subtask.create({
    data: {
      deliverableId,
      title,
      description,
      dueDate,
      assigneeId: assigneeId || null,
      orderIndex: count,
    },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
  redirect(`/projects/${deliverable.projectId}`);
}

export async function updateSubtaskStatus(subtaskId: string, status: TimelineStatus) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      status,
      completedAt:
        status === TimelineStatus.COMPLETE ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}
