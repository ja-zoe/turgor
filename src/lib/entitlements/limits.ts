import "server-only";
import { limit } from "@/lib/entitlements";
import type { LimitKey } from "@/lib/entitlements/features";

/**
 * Quota enforcement (set 37). `assertWithinLimit` is the server-side guard the "gated writes
 * re-check" rule (R36.3) requires. Under the community provider every limit is `null`
 * (unlimited), so this is a no-op for the free/self-hosted tier — it only bites when a cloud
 * provider returns a finite cap.
 */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

const FRIENDLY: Record<LimitKey, string> = {
  MAX_PROJECTS: "Project limit reached",
  MAX_MEMBERS: "Member limit reached",
};

/**
 * Throw if adding one more of `key` would exceed the org's plan cap. `currentCount` is the
 * caller's live count of the thing being limited. No-op when the plan grants unlimited.
 */
export async function assertWithinLimit(
  orgId: string,
  key: LimitKey,
  currentCount: number,
): Promise<void> {
  const cap = await limit(orgId, key);
  if (cap !== null && currentCount >= cap) {
    throw new QuotaError(`${FRIENDLY[key]} (${cap}) for your plan. Upgrade to add more.`);
  }
}
