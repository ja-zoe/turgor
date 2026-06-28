"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, Channel, RecipientGroup, TriggerType } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  const weeksBehindMilestone = parseInt(formData.get("weeksBehindMilestone") as string, 10);
  const missedGoalsInARow = parseInt(formData.get("missedGoalsInARow") as string, 10);
  const requireBoth = formData.get("requireBoth") === "on";
  const submissionDeadlineHours = parseInt(formData.get("submissionDeadlineHours") as string, 10);
  const statusSubmitWindowDaysRaw = parseInt(formData.get("statusSubmitWindowDays") as string, 10);
  const statusSubmitWindowDays = Number.isFinite(statusSubmitWindowDaysRaw) && statusSubmitWindowDaysRaw > 0
    ? statusSubmitWindowDaysRaw
    : 3;

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { weeksBehindMilestone, missedGoalsInARow, requireBoth, submissionDeadlineHours, statusSubmitWindowDays },
    create: {
      id: "singleton",
      weeksBehindMilestone,
      missedGoalsInARow,
      requireBoth,
      submissionDeadlineHours,
      statusSubmitWindowDays,
    },
  });

  revalidatePath("/pm/settings");
}

export async function createNotificationRule(formData: FormData) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  const name = (formData.get("name") as string).trim();
  const triggerType = formData.get("triggerType") as TriggerType;
  const channel = formData.get("channel") as Channel;
  const recipients = formData.get("recipients") as RecipientGroup;
  const thresholdHoursRaw = formData.get("thresholdHours") as string | null;
  const thresholdHours = thresholdHoursRaw ? parseInt(thresholdHoursRaw, 10) : null;

  if (!name || !triggerType || !channel || !recipients) {
    throw new Error("All fields are required");
  }

  await prisma.notificationRule.create({
    data: { name, triggerType, channel, recipients, thresholdHours },
  });

  revalidatePath("/pm/settings");
}

export async function toggleNotificationRule(ruleId: string, enabled: boolean) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);
  await prisma.notificationRule.update({ where: { id: ruleId }, data: { enabled } });
  revalidatePath("/pm/settings");
}

export async function deleteNotificationRule(ruleId: string) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);
  await prisma.notificationRule.delete({ where: { id: ruleId } });
  revalidatePath("/pm/settings");
}
