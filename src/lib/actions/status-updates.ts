"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, getProjectMembership, getUserPermissions } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { getActiveLeadMeeting } from "@/lib/lead-meeting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitStatusUpdate(projectId: string, formData: FormData) {
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership || membership.role === "MEMBER") {
    throw new Error("Only project leads and subleads can submit status updates");
  }

  // The update corresponds to the project's active lead meeting (R10.2).
  const active = await getActiveLeadMeeting(projectId);
  if (!active) {
    throw new Error("There is no lead meeting open for submission for this project");
  }

  const plannedWork = (formData.get("plannedWork") as string).trim();
  const actualProgress = (formData.get("actualProgress") as string).trim();
  const blockers = (formData.get("blockers") as string).trim();
  const nextWeekGoals = (formData.get("nextWeekGoals") as string).trim();
  const needsHelp = formData.get("needsHelp") === "on";
  const helpNeeded = (formData.get("helpNeeded") as string | null)?.trim() || null;

  await prisma.statusUpdate.create({
    data: {
      projectId,
      submittedById: user.id,
      calendarEventId: active.meeting.id,
      meetingDate: active.meeting.startsAt, // derived from the lead meeting
      plannedWork,
      actualProgress,
      blockers,
      nextWeekGoals,
      needsHelp,
      helpNeeded: needsHelp ? helpNeeded : null,
      isLate: active.isLate, // late once past the meeting start time
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

/**
 * Who may edit/delete a status update:
 *  - anyone with MANAGE_STATUS_UPDATES (PM, Eboard) — any time;
 *  - the submitting lead/sublead — only **before** the linked meeting's start (due time).
 */
async function assertCanModifyStatusUpdate(statusUpdateId: string) {
  const user = await requireAuth();
  const update = await prisma.statusUpdate.findUniqueOrThrow({
    where: { id: statusUpdateId },
    include: { calendarEvent: { select: { startsAt: true } } },
  });

  const permissions = await getUserPermissions(user.roleId ?? null);
  if (permissions.includes(Permission.MANAGE_STATUS_UPDATES)) return update;

  if (update.submittedById !== user.id) {
    throw new Error("You can only edit your own status updates");
  }
  const membership = await getProjectMembership(user.id, update.projectId);
  if (!membership || membership.role === "MEMBER") {
    throw new Error("Only project leads can edit status updates");
  }
  const due = update.calendarEvent?.startsAt ?? update.meetingDate;
  if (new Date() > new Date(due)) {
    throw new Error("This status update is past its meeting and can no longer be edited");
  }
  return update;
}

export async function updateStatusUpdate(statusUpdateId: string, formData: FormData) {
  const update = await assertCanModifyStatusUpdate(statusUpdateId);

  const plannedWork = (formData.get("plannedWork") as string).trim();
  const actualProgress = (formData.get("actualProgress") as string).trim();
  const blockers = (formData.get("blockers") as string).trim();
  const nextWeekGoals = (formData.get("nextWeekGoals") as string).trim();
  const needsHelp = formData.get("needsHelp") === "on";
  const helpNeeded = (formData.get("helpNeeded") as string | null)?.trim() || null;

  await prisma.statusUpdate.update({
    where: { id: statusUpdateId },
    data: { plannedWork, actualProgress, blockers, nextWeekGoals, needsHelp, helpNeeded: needsHelp ? helpNeeded : null },
  });

  revalidatePath(`/projects/${update.projectId}`);
}

export async function deleteStatusUpdate(statusUpdateId: string) {
  const update = await assertCanModifyStatusUpdate(statusUpdateId);
  await prisma.statusUpdate.delete({ where: { id: statusUpdateId } });
  revalidatePath(`/projects/${update.projectId}`);
}
