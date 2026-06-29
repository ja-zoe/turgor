"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, ProjectStatus } from "@/generated/prisma";
import { carryOverActionItems } from "@/lib/actions/action-items";
import { runRedFlagDetection } from "@/lib/red-flag";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createMeetingRecord(projectId: string, formData: FormData) {
  const user = await requirePermission(Permission.POST_MEETING_TRACKING);

  const meetingDate = new Date(formData.get("meetingDate") as string);
  const status = formData.get("status") as ProjectStatus;
  const goalMet =
    formData.get("goalMet") === "true"
      ? true
      : formData.get("goalMet") === "false"
        ? false
        : null;
  const keyBlockers = (formData.get("keyBlockers") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const record = await prisma.meetingRecord.create({
    data: {
      projectId,
      meetingDate,
      status,
      goalMet,
      keyBlockers,
      notes,
      recordedById: user.id,
    },
  });

  // Apply PM-chosen status first (unless manually overridden)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { statusOverride: true },
  });
  if (!project?.statusOverride) {
    await prisma.project.update({ where: { id: projectId }, data: { status } });
  }

  // Carry over all open action items from previous meetings
  await carryOverActionItems(projectId);

  // Run red-flag detection — may escalate status to BEHIND
  await runRedFlagDetection(projectId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}?meeting=${record.id}`);
}

export async function deleteMeetingRecord(meetingRecordId: string) {
  await requirePermission(Permission.MANAGE_MEETING_RECORDS);

  const record = await prisma.meetingRecord.findUnique({
    where: { id: meetingRecordId },
    select: { id: true, projectId: true },
  });
  if (!record) return;

  // Action items carried at this meeting are preserved — ActionItem.meetingId is an
  // optional FK (onDelete: SetNull), so deleting the record nulls their meetingId.
  await prisma.meetingRecord.delete({ where: { id: meetingRecordId } });

  // History changed — let red-flag auto-detection re-evaluate (respects statusOverride).
  await runRedFlagDetection(record.projectId);

  revalidatePath(`/projects/${record.projectId}`);
  revalidatePath(`/projects/${record.projectId}/history`);
  revalidatePath("/projects");
}
