import "server-only";
import { cache } from "react";
import type { Feature, LimitKey } from "@/lib/entitlements/features";
import type { OrgEntitlements } from "@/lib/entitlements/types";
import { activeProviderPromise } from "@/lib/entitlements/load-provider";

/**
 * Entitlements resolver (set 36) — the public API the app calls to gate premium features.
 *
 * Server-only: entitlements never resolve on the client. Callers pass the active `orgId`
 * (from `getTenantContext()` on pages, or `user.orgId` in actions/MCP). This module does not
 * import `auth`/`tenant` — the caller supplies `orgId`, keeping the import graph acyclic
 * (same discipline as `tenant-db.ts`).
 *
 * The active provider is the community provider (all unlocked) unless `ENTITLEMENTS_PROVIDER`
 * loads a cloud provider (R36.2); `can`/`limit`/`getPlan` are unchanged by that swap.
 */

/**
 * Resolve an org's full entitlement set. React `cache()`-wrapped so many `can()`/`limit()`
 * calls in one render trigger a single provider resolution per org.
 */
export const getEntitlements = cache(
  async (orgId: string): Promise<OrgEntitlements> => (await activeProviderPromise).getEntitlements(orgId),
);

/** Whether an org is entitled to a boolean feature. */
export async function can(orgId: string, feature: Feature): Promise<boolean> {
  return (await getEntitlements(orgId)).features[feature];
}

/** An org's numeric quota for a limit key; `null` = unlimited. */
export async function limit(orgId: string, key: LimitKey): Promise<number | null> {
  return (await getEntitlements(orgId)).limits[key];
}

/** An org's plan label (`"community"` in the free build). */
export async function getPlan(orgId: string): Promise<string> {
  return (await getEntitlements(orgId)).plan;
}
