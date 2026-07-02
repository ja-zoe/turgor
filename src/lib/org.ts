import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type OrgSettings = {
  orgName: string;
  orgFullName: string;
  orgInstitution: string;
  orgLogoUrl: string;
  signInLabel: string;
  /** What a project cycle is called — "Semester", "Quarter", "Cycle"… Display-only;
   *  the `Project.semester` data field and form/query names stay `semester`. */
  periodLabel: string;
  /** Derived: `${orgName} Tracker` — short app name (sidebar, metadata title). */
  appName: string;
  /** Derived: `${orgName} Project Tracker` — full app name (landing hero, emails). */
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
    },
  });

  const base = settings ?? DEFAULTS;
  return {
    ...base,
    appName: `${base.orgName} Tracker`,
    appFullName: `${base.orgName} Project Tracker`,
    periodLabelLower: base.periodLabel.toLowerCase(),
  };
});
