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
  const group = (formData.get("group") as string | null)?.trim() || null;

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
      group,
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
  const group = (formData.get("group") as string | null)?.trim() || null;

  // Status is omitted from the form when the deliverable has subtasks (locked field).
  const statusRaw = formData.get("status") as string | null;
  const statusUpdate = statusRaw
    ? {
        status: statusRaw as TimelineStatus,
        completed: statusRaw === TimelineStatus.COMPLETE,
        completedDate: statusRaw === TimelineStatus.COMPLETE ? new Date() : null,
      }
    : {};

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { title, description, targetDate, startDate, group, ...statusUpdate },
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

export async function updateSubtask(subtaskId: string, formData: FormData) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  const assigneeId = (formData.get("assigneeId") as string | null) || null;
  const status = formData.get("status") as TimelineStatus;

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      title,
      description,
      dueDate,
      assigneeId: assigneeId || null,
      status,
      completedAt: status === TimelineStatus.COMPLETE ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
  redirect(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateSubtaskStatus(subtaskId: string, status: TimelineStatus) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { id: true, projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      status,
      completedAt: status === TimelineStatus.COMPLETE ? new Date() : null,
    },
  });

  // Derive the parent deliverable's status from all its subtasks after this update.
  const siblings = await prisma.subtask.findMany({
    where: { deliverableId: subtask.deliverable.id },
    select: { status: true },
  });

  let derivedStatus: TimelineStatus;
  if (siblings.every((s) => s.status === TimelineStatus.COMPLETE)) {
    derivedStatus = TimelineStatus.COMPLETE;
  } else if (siblings.some((s) => s.status === TimelineStatus.BLOCKED)) {
    derivedStatus = TimelineStatus.BLOCKED;
  } else if (siblings.some((s) => s.status === TimelineStatus.IN_PROGRESS || s.status === TimelineStatus.COMPLETE)) {
    derivedStatus = TimelineStatus.IN_PROGRESS;
  } else {
    derivedStatus = TimelineStatus.NOT_STARTED;
  }

  const isNowComplete = derivedStatus === TimelineStatus.COMPLETE;
  await prisma.deliverable.update({
    where: { id: subtask.deliverable.id },
    data: {
      status: derivedStatus,
      completed: isNowComplete,
      completedDate: isNowComplete ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateSubtaskTitle(subtaskId: string, title: string) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title cannot be empty");

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { title: trimmed },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function deleteSubtask(subtaskId: string) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.delete({ where: { id: subtaskId } });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateDeliverableStatus(deliverableId: string, status: TimelineStatus) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    include: { _count: { select: { subtasks: true } } },
  });

  if (deliverable._count.subtasks > 0) {
    throw new Error("Status is derived from subtasks and cannot be set manually");
  }

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const isComplete = status === TimelineStatus.COMPLETE;
  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { status, completed: isComplete, completedDate: isComplete ? new Date() : null },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function updateSubtaskAssignee(subtaskId: string, assigneeId: string | null) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { assigneeId: assigneeId ?? null },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateSubtaskDueDate(subtaskId: string, dueDate: string | null) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateDeliverableTitle(deliverableId: string, title: string) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title cannot be empty");

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { title: trimmed },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function updateDeliverableDates(
  deliverableId: string,
  startDate: string | null,
  targetDate: string,
) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const target = new Date(targetDate);
  const start = startDate ? new Date(startDate) : null;
  if (start && start > target) throw new Error("Start date must not be after target date");

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { startDate: start, targetDate: target },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
}
