import type { Feature, LimitKey } from "@/lib/entitlements/features";

/**
 * An org's fully-resolved entitlement set. The provider resolves this once per org per
 * request; `can`/`limit`/`getPlan` (in index.ts) read from it, so many gate checks in one
 * render cost a single provider resolution.
 */
export type OrgEntitlements = {
  /** Plan label. `"community"` in the free build. */
  plan: string;
  /** Every boolean feature, fully resolved for the org. */
  features: Record<Feature, boolean>;
  /** Every quota key; `null` = unlimited. */
  limits: Record<LimitKey, number | null>;
};

/**
 * The contract the private turgor-cloud repo implements and core loads (R36.2). The free
 * build uses the community provider (all unlocked). A conforming module exports a named
 * `entitlementsProvider: EntitlementsProvider`.
 */
export interface EntitlementsProvider {
  getEntitlements(orgId: string): Promise<OrgEntitlements>;
}
