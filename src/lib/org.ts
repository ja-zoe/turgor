import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isThemePresetId } from "@/lib/themes";
import { DEFAULT_ORG_ID, ACTIVE_ORG_SLUG_HEADER } from "@/lib/tenant-db";

export type OrgSettings = {
  orgName: string;
  orgFullName: string;
  orgInstitution: string;
  orgLogoUrl: string;
  /** What a project cycle is called — "Semester", "Quarter", "Cycle"… Display-only;
   *  the `Project.semester` data field and form/query names stay `semester`. */
  periodLabel: string;
  /** Curated theme family id (see src/lib/themes.ts). Normalized: any unknown or
   *  legacy value (incl. R29.2 "custom") resolves to "forest". */
  themePreset: string;
  /** App name (sidebar, metadata title). R32.2 chain: Settings.appName →
   *  orgName when customized → "Turgor". No derived "Tracker" suffixes. */
  appName: string;
  /** Full app name (landing hero, emails). Identical to appName since R32.2;
   *  both keys stay because each has ~10 consumers. */
  appFullName: string;
  /** True when nothing is branded (no appName, stock orgName) — lockup components
   *  render the turgor wordmark treatment instead of an org identity (R32.3). */
  isDefaultBrand: boolean;
  /** Derived: `periodLabel.toLowerCase()` — for mid-sentence use ("built for the semester").
   *  Plural forms are naive `+s` at the call site ("semesters", "quarters"). */
  periodLabelLower: string;
};

const DEFAULTS = {
  orgName: "Turgor",
  orgFullName: "Turgor",
  orgInstitution: "",
  orgLogoUrl: "/turgor-logo.svg",
  periodLabel: "Semester",
  themePreset: "forest",
  appName: null as string | null,
} as const;

/**
 * Org identity for branding surfaces. Cached per request via React cache().
 * Falls back to the stock Turgor defaults when the Settings row doesn't exist
 * yet (pre-seed boot) OR the database is unreachable, so branding consumers
 * never crash. The unreachable case matters at build time: Next always
 * prerenders a static `/_not-found` shell (and any `○` page), which runs the
 * root layout through here — a CI/Vercel build with no reachable database must
 * not fail on it. An adopting org overrides these in PM Tools → Settings;
 * SEED's live deployment stores its own SEED values in the Settings row.
 */
export const getOrgSettings = cache(async (orgId: string = DEFAULT_ORG_ID): Promise<OrgSettings> => {
  const settings = await prisma.settings
    .findUnique({
      where: { orgId },
      select: {
        orgName: true,
        orgFullName: true,
        orgInstitution: true,
        orgLogoUrl: true,
        periodLabel: true,
        themePreset: true,
        appName: true,
      },
    })
    .catch((err: unknown) => {
      // DB unreachable (build-time prerender with no database, or a transient
      // outage) — degrade to stock Turgor branding rather than crash the render.
      console.warn(
        "[org] Settings lookup failed; falling back to default branding:",
        err instanceof Error ? err.message : err,
      );
      return null;
    });

  const base = settings ?? DEFAULTS;
  // R32.2: appName → orgName when customized → "Turgor". Plain-text surfaces keep
  // the capitalized form; only rendered lockups lowercase it (R32.3).
  const resolvedName =
    base.appName ?? (base.orgName !== DEFAULTS.orgName ? base.orgName : "Turgor");
  return {
    ...base,
    appName: resolvedName,
    appFullName: resolvedName,
    isDefaultBrand: base.appName === null && base.orgName === DEFAULTS.orgName,
    // R32.4: normalize legacy/unknown family ids (incl. removed "custom") to forest.
    themePreset: isThemePresetId(base.themePreset) ? base.themePreset : "forest",
    periodLabelLower: base.periodLabel.toLowerCase(),
  };
});

/** Stock Turgor branding (no org). */
function stockBrand(): OrgSettings {
  return {
    orgName: DEFAULTS.orgName,
    orgFullName: DEFAULTS.orgFullName,
    orgInstitution: DEFAULTS.orgInstitution,
    orgLogoUrl: DEFAULTS.orgLogoUrl,
    periodLabel: DEFAULTS.periodLabel,
    themePreset: "forest",
    appName: "Turgor",
    appFullName: "Turgor",
    isDefaultBrand: true,
    periodLabelLower: DEFAULTS.periodLabel.toLowerCase(),
  };
}

/**
 * Branding for the UNAUTHENTICATED sign-in surfaces (R39.1). Dynamic-only (reads the request
 * header), so never call it from `generateMetadata`/static prerender. On self-host
 * (`TURGOR_CLOUD` unset) it's the default org, unchanged. On Turgor Cloud it resolves the
 * subdomain: no subdomain (apex) → stock Turgor; a subdomain → that org's brand.
 */
export async function getSigninBrand(): Promise<OrgSettings> {
  if (!process.env.TURGOR_CLOUD) return getOrgSettings();
  const slug = (await headers()).get(ACTIVE_ORG_SLUG_HEADER);
  if (!slug) return stockBrand();
  const org = await prisma.organization
    .findUnique({ where: { slug }, select: { id: true } })
    .catch(() => null);
  return org ? getOrgSettings(org.id) : stockBrand();
}
