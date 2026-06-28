"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, getProjectMembership } from "@/lib/permissions";
import { Permission, TimelineStatus, Priority } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Recompute a deliverable's status from its subtasks and persist it. Must run after
 * ANY change to the subtask set (status edit, create, delete) — not just status edits —
 * otherwise the derived status goes stale (e.g. adding a subtask under an all-complete
 * deliverable should drop it out of COMPLETE).
 */
export async function deriveDeliverableStatus(deliverableId: string) {
  const siblings = await prisma.subtask.findMany({
    where: { deliverableId },
    select: { status: true },
  });

  // No subtasks left → the deliverable becomes manually-controlled again; clear
  // completion but leave its current status untouched.
  if (siblings.length === 0) {
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: { completed: false, completedDate: null },
    });
    return;
  }

  let derivedStatus: TimelineStatus;
  if (siblings.every((s) => s.status === TimelineStatus.COMPLETE)) {
    derivedStatus = TimelineStatus.COMPLETE;
  } else if (siblings.some((s) => s.status === TimelineStatus.BLOCKED)) {
    derivedStatus = TimelineStatus.BLOCKED;
  } else if (
    siblings.some(
      (s) => s.status === TimelineStatus.IN_PROGRESS || s.status === TimelineStatus.COMPLETE,
    )
  ) {
    derivedStatus = TimelineStatus.IN_PROGRESS;
  } else {
    derivedStatus = TimelineStatus.NOT_STARTED;
  }

  const isComplete = derivedStatus === TimelineStatus.COMPLETE;
  // Preserve the original completion date if it was already complete.
  const existing = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { completedDate: true },
  });
  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      status: derivedStatus,
      completed: isComplete,
      completedDate: isComplete ? existing?.completedDate ?? new Date() : null,
    },
  });
}

/**
 * Reject a subtask due date that falls outside its deliverable's window
 * (after the target date, or before the start date). No-op for a null date.
 */
async function assertDueWithinDeliverable(deliverableId: string, dueDate: Date | null) {
  if (!dueDate) return;
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { startDate: true, targetDate: true },
  });
  if (!d) return;
  if (dueDate > d.targetDate || (d.startDate && dueDate < d.startDate)) {
    throw new Error("Due date must fall within the deliverable's dates");
  }
}

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
  const priorityRaw = formData.get("priority") as string | null;

  // Status is omitted from the form when the deliverable has subtasks (locked field).
  const statusRaw = formData.get("status") as string | null;
  const statusUpdate = statusRaw
    ? {
        status: statusRaw as TimelineStatus,
        completed: statusRaw === TimelineStatus.COMPLETE,
        completedDate: statusRaw === TimelineStatus.COMPLETE ? new Date() : null,
      }
    : {};

  if (startDate && startDate > targetDate) {
    throw new Error("Start date must not be after target date");
  }

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      title, description, targetDate, startDate, group,
      ...(priorityRaw ? { priority: priorityRaw as Priority } : {}),
      ...statusUpdate,
    },
  });

  // No redirect — the edit modal closes itself; revalidate refreshes in place.
  revalidatePath(`/projects/${deliverable.projectId}`);
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

  await assertDueWithinDeliverable(deliverableId, dueDate);

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

  // A new subtask changes the set → re-derive the deliverable's status.
  await deriveDeliverableStatus(deliverableId);

  // No redirect — created from the in-page modal; revalidate refreshes the list.
  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function updateSubtask(subtaskId: string, formData: FormData) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { id: true, projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  const assigneeId = (formData.get("assigneeId") as string | null) || null;
  const status = formData.get("status") as TimelineStatus;

  await assertDueWithinDeliverable(subtask.deliverable.id, dueDate);

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

  // Status may have changed → re-derive the parent deliverable.
  await deriveDeliverableStatus(subtask.deliverable.id);

  // No redirect — used by the in-page modal; the full-page edit form redirects itself.
  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
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
  await deriveDeliverableStatus(subtask.deliverable.id);

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
    include: { deliverable: { select: { id: true, projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.delete({ where: { id: subtaskId } });

  // Removing a subtask changes the set → re-derive the deliverable's status.
  await deriveDeliverableStatus(subtask.deliverable.id);

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

export async function updateSubtaskDescription(subtaskId: string, description: string | null) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { description: description?.trim() || null },
  });

  revalidatePath(`/projects/${subtask.deliverable.projectId}`);
}

export async function updateSubtaskDueDate(subtaskId: string, dueDate: string | null) {
  const user = await requireAuth();

  const subtask = await prisma.subtask.findUniqueOrThrow({
    where: { id: subtaskId },
    include: { deliverable: { select: { id: true, projectId: true } } },
  });

  const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await assertDueWithinDeliverable(subtask.deliverable.id, dueDate ? new Date(dueDate) : null);

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

export async function updateDeliverableGroup(deliverableId: string, group: string | null) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const trimmed = group?.trim() || null;

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { group: trimmed },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
}

/**
 * Manually reorder a deliverable within its group, among siblings of the **same
 * priority** (priority is the primary sort key; orderIndex orders within a tier).
 * Swaps orderIndex with the adjacent same-group, same-priority deliverable.
 */
export async function moveDeliverable(deliverableId: string, direction: "up" | "down") {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true, group: true, priority: true, orderIndex: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  const siblings = await prisma.deliverable.findMany({
    where: {
      projectId: deliverable.projectId,
      group: deliverable.group,
      priority: deliverable.priority,
    },
    orderBy: { orderIndex: "asc" },
    select: { id: true, orderIndex: true },
  });

  const idx = siblings.findIndex((s) => s.id === deliverableId);
  const swapWith = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) return; // already at the tier boundary

  await prisma.$transaction([
    prisma.deliverable.update({ where: { id: deliverableId }, data: { orderIndex: swapWith.orderIndex } }),
    prisma.deliverable.update({ where: { id: swapWith.id }, data: { orderIndex: deliverable.orderIndex } }),
  ]);

  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function updateDeliverablePriority(deliverableId: string, priority: Priority) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { priority },
  });

  revalidatePath(`/projects/${deliverable.projectId}`);
}

export async function updateDeliverableDescription(deliverableId: string, description: string | null) {
  const user = await requireAuth();

  const deliverable = await prisma.deliverable.findUniqueOrThrow({
    where: { id: deliverableId },
    select: { projectId: true },
  });

  const membership = await getProjectMembership(user.id, deliverable.projectId);
  if (!membership) await requirePermission(Permission.MANAGE_MILESTONES);

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { description: description?.trim() || null },
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
