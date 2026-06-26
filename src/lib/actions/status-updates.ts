"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, getProjectMembership } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitStatusUpdate(projectId: string, formData: FormData) {
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership || membership.role === "MEMBER") {
    throw new Error("Only project leads and subleads can submit status updates");
  }

  const meetingDate = new Date(formData.get("meetingDate") as string);
  const plannedWork = (formData.get("plannedWork") as string).trim();
  const actualProgress = (formData.get("actualProgress") as string).trim();
  const blockers = (formData.get("blockers") as string).trim();
  const nextWeekGoals = (formData.get("nextWeekGoals") as string).trim();
  const needsHelp = formData.get("needsHelp") === "on";
  const helpNeeded = (formData.get("helpNeeded") as string | null)?.trim() || null;

  // Late-marking: deadline is meetingDate minus submissionDeadlineHours
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const deadlineHours = settings?.submissionDeadlineHours ?? 24;
  const deadline = new Date(meetingDate.getTime() - deadlineHours * 60 * 60 * 1000);
  const isLate = new Date() > deadline;

  await prisma.statusUpdate.create({
    data: {
      projectId,
      submittedById: user.id,
      meetingDate,
      plannedWork,
      actualProgress,
      blockers,
      nextWeekGoals,
      needsHelp,
      helpNeeded: needsHelp ? helpNeeded : null,
      isLate,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
