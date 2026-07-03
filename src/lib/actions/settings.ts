"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, Channel, RecipientGroup, TriggerType } from "@/generated/prisma";
import { isThemePresetId, isCustomColors } from "@/lib/themes";
import { storageConfigured, uploadPublicAsset } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * R29.1 — upload an org logo to Supabase Storage and point Settings.orgLogoUrl at
 * its public URL. Returns { error } instead of throwing so the uploader component
 * can render failures inline.
 */
export async function uploadOrgLogo(formData: FormData): Promise<{ error?: string; url?: string }> {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  if (!storageConfigured()) {
    return { error: "Uploads are not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const file = formData.get("logoFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { error: "The logo must be a PNG, JPEG, SVG, or WebP image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "The logo must be 2 MB or smaller." };
  }

  let url: string;
  try {
    url = await uploadPublicAsset(file, "logo");
  } catch (e) {
    console.error("logo upload failed", e);
    return { error: "Upload failed — check the storage configuration and try again." };
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { orgLogoUrl: url },
    create: { id: "singleton", orgLogoUrl: url },
  });
  revalidatePath("/", "layout");
  revalidatePath("/pm/settings");
  return { url };
}

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

  // Curated preset ids plus "custom" (R29.2); anything else keeps the current theme.
  const themePresetRaw = ((formData.get("themePreset") as string) ?? "").trim();
  const themePreset =
    isThemePresetId(themePresetRaw) || themePresetRaw === "custom"
      ? themePresetRaw
      : current?.themePreset ?? "forest";

  // Custom palette: persisted whenever submitted-and-valid (so switching presets
  // and back keeps the last choice); a custom save with a malformed hex is rejected.
  const submittedColors = {
    primary: ((formData.get("customPrimary") as string) ?? "").trim(),
    background: ((formData.get("customBackground") as string) ?? "").trim(),
    card: ((formData.get("customCard") as string) ?? "").trim(),
  };
  const anyColorSubmitted = Boolean(
    submittedColors.primary || submittedColors.background || submittedColors.card
  );
  let customColors =
    current && isCustomColors(current.customColors) ? current.customColors : null;
  if (isCustomColors(submittedColors)) {
    customColors = submittedColors;
  } else if (themePreset === "custom" && anyColorSubmitted) {
    throw new Error("Custom colors must be 6-digit hex values like #2E4034.");
  }
  if (themePreset === "custom" && !customColors) {
    throw new Error("Pick the three custom colors before selecting the Custom theme.");
  }

  const data = { orgName, orgFullName, orgInstitution, orgLogoUrl, signInLabel, periodLabel, themePreset, appName, customColors: customColors ?? undefined };

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
