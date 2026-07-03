"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, Channel, RecipientGroup, TriggerType } from "@/generated/prisma";
import { isThemePresetId } from "@/lib/themes";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  const weeksBehindMilestone = parseInt(formData.get("weeksBehindMilestone") as string, 10);
  const missedGoalsInARow = parseInt(formData.get("missedGoalsInARow") as string, 10);
  const requireBoth = formData.get("requireBoth") === "on";
  const statusSubmitWindowDaysRaw = parseInt(formData.get("statusSubmitWindowDays") as string, 10);
  const statusSubmitWindowDays = Number.isFinite(statusSubmitWindowDaysRaw) && statusSubmitWindowDaysRaw > 0
    ? statusSubmitWindowDaysRaw
    : 3;
  const statusLateWindowDaysRaw = parseInt(formData.get("statusLateWindowDays") as string, 10);
  const statusLateWindowDays = Number.isFinite(statusLateWindowDaysRaw) && statusLateWindowDaysRaw >= 0
    ? statusLateWindowDaysRaw
    : 3;

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { weeksBehindMilestone, missedGoalsInARow, requireBoth, statusSubmitWindowDays, statusLateWindowDays },
    create: {
      id: "singleton",
      weeksBehindMilestone,
      missedGoalsInARow,
      requireBoth,
      statusSubmitWindowDays,
      statusLateWindowDays,
    },
  });

  revalidatePath("/pm/settings");
}

export async function updateOrgSettings(formData: FormData) {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  const current = await prisma.settings.findUnique({ where: { id: "singleton" } });

  const orgNameRaw = ((formData.get("orgName") as string) ?? "").trim();
  const signInLabelRaw = ((formData.get("signInLabel") as string) ?? "").trim();
  const orgLogoUrlRaw = ((formData.get("orgLogoUrl") as string) ?? "").trim();
  const periodLabelRaw = ((formData.get("periodLabel") as string) ?? "").trim();

  // orgName / signInLabel / orgLogoUrl / periodLabel render in the shell and must never
  // be blank: an emptied field keeps its current value instead of erroring.
  const orgName = orgNameRaw || current?.orgName || "SEED";
  const signInLabel = signInLabelRaw || current?.signInLabel || "Rutgers NetID";
  const orgLogoUrl = orgLogoUrlRaw || current?.orgLogoUrl || "/seed-logo-transparent.png";
  const periodLabel = periodLabelRaw || current?.periodLabel || "Semester";
  const orgFullName = ((formData.get("orgFullName") as string) ?? "").trim();
  const orgInstitution = ((formData.get("orgInstitution") as string) ?? "").trim();
  // App-name override (R29.3): empty means "derive <orgName> Tracker" — stored null.
  const appName = ((formData.get("appName") as string) ?? "").trim() || null;

  // Only curated preset ids are accepted; anything else keeps the current theme.
  const themePresetRaw = ((formData.get("themePreset") as string) ?? "").trim();
  const themePreset = isThemePresetId(themePresetRaw)
    ? themePresetRaw
    : current?.themePreset ?? "forest";

  const data = { orgName, orgFullName, orgInstitution, orgLogoUrl, signInLabel, periodLabel, themePreset, appName };

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  // Branding renders on every page (sidebar, metadata), not just the settings page.
  revalidatePath("/", "layout");
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
