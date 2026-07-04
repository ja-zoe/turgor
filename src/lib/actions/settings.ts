"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, Channel, RecipientGroup, TriggerType } from "@/generated/prisma";
import { isThemePresetId } from "@/lib/themes";
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
  const orgName = orgNameRaw || current?.orgName || "Turgor";
  const signInLabel = signInLabelRaw || current?.signInLabel || "Email";
  const orgLogoUrl = orgLogoUrlRaw || current?.orgLogoUrl || "/turgor-logo.svg";
  const periodLabel = periodLabelRaw || current?.periodLabel || "Semester";
  const orgFullName = ((formData.get("orgFullName") as string) ?? "").trim();
  const orgInstitution = ((formData.get("orgInstitution") as string) ?? "").trim();
  // App-name override (R29.3): empty means "derive via the R32.2 chain" — stored null.
  const appName = ((formData.get("appName") as string) ?? "").trim() || null;

  // Curated theme family id (R24.3, R32.4); anything else keeps the current family.
  // The R29.2 "custom" option was removed — a legacy stored "custom" is normalized
  // to forest on read (getOrgSettings).
  const themePresetRaw = ((formData.get("themePreset") as string) ?? "").trim();
  const themePreset = isThemePresetId(themePresetRaw)
    ? themePresetRaw
    : current?.themePreset ?? "forest";

  // Sign-in method (R29.4). A disabled select (env override active) submits
  // nothing → the stored value is kept.
  const authProviderRaw = ((formData.get("authProvider") as string) ?? "").trim();
  const authProvider =
    authProviderRaw === "cas" || authProviderRaw === "email"
      ? authProviderRaw
      : current?.authProvider ?? "email";

  const data = { orgName, orgFullName, orgInstitution, orgLogoUrl, signInLabel, periodLabel, themePreset, appName, authProvider };

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
