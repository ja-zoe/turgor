import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isCustomColors, type CustomColors } from "@/lib/themes";

export type OrgSettings = {
  orgName: string;
  orgFullName: string;
  orgInstitution: string;
  orgLogoUrl: string;
  signInLabel: string;
  /** What a project cycle is called — "Semester", "Quarter", "Cycle"… Display-only;
   *  the `Project.semester` data field and form/query names stay `semester`. */
  periodLabel: string;
  /** Curated color theme id (see src/lib/themes.ts) or "custom" (R29.2). */
  themePreset: string;
  /** Validated custom palette when themePreset is "custom"; null otherwise/invalid. */
  customColors: CustomColors | null;
  /** Short app name (sidebar, metadata title). The Settings.appName override wins
   *  (R29.3); null derives `${orgName} Tracker`. */
  appName: string;
  /** Full app name (landing hero, emails). Same override; derives
   *  `${orgName} Project Tracker` when unset — setting appName replaces the whole line. */
  appFullName: string;
  /** Derived: `periodLabel.toLowerCase()` — for mid-sentence use ("built for the semester").
   *  Plural forms are naive `+s` at the call site ("semesters", "quarters"). */
  periodLabelLower: string;
};

const DEFAULTS = {
  orgName: "SEED",
  orgFullName: "Students for Environmental & Energy Development",
  orgInstitution: "Rutgers University–New Brunswick",
  orgLogoUrl: "/seed-logo-transparent.png",
  signInLabel: "Rutgers NetID",
  periodLabel: "Semester",
  themePreset: "forest",
  appName: null as string | null,
  customColors: null,
} as const;

/**
 * Org identity for branding surfaces. Cached per request via React cache().
 * Falls back to the SEED defaults when the Settings row doesn't exist yet
 * (pre-seed boot), so branding consumers never crash.
 */
export const getOrgSettings = cache(async (): Promise<OrgSettings> => {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: {
      orgName: true,
      orgFullName: true,
      orgInstitution: true,
      orgLogoUrl: true,
      signInLabel: true,
      periodLabel: true,
      themePreset: true,
      appName: true,
      customColors: true,
    },
  });

  const base = settings ?? DEFAULTS;
  return {
    ...base,
    appName: base.appName ?? `${base.orgName} Tracker`,
    appFullName: base.appName ?? `${base.orgName} Project Tracker`,
    periodLabelLower: base.periodLabel.toLowerCase(),
    customColors: isCustomColors(base.customColors) ? base.customColors : null,
  };
});
