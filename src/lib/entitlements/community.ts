import { ALL_FEATURES, ALL_LIMIT_KEYS, type Feature, type LimitKey } from "@/lib/entitlements/features";
import type { EntitlementsProvider, OrgEntitlements } from "@/lib/entitlements/types";

/**
 * The community (free / self-hosted) provider: everything unlocked, every quota unlimited.
 * This is the default the free build always uses (until R36.2 optionally swaps in the cloud
 * provider). Pure and synchronous under the hood — no DB, no plan lookup — so gating adds
 * zero cost to the free tier.
 */
const ALL_ON: OrgEntitlements = {
  plan: "community",
  features: Object.fromEntries(ALL_FEATURES.map((f) => [f, true])) as Record<Feature, boolean>,
  limits: Object.fromEntries(ALL_LIMIT_KEYS.map((k) => [k, null])) as Record<LimitKey, number | null>,
};

export const communityProvider: EntitlementsProvider = {
  async getEntitlements(_orgId: string): Promise<OrgEntitlements> {
    return ALL_ON;
  },
};
