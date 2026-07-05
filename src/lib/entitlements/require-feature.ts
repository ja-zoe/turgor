import "server-only";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { can } from "@/lib/entitlements";
import type { Feature } from "@/lib/entitlements/features";

/**
 * Route-level entitlement guard (R36.3) — mirrors `requirePermission`. Resolves the active
 * org from the session (set 35's `getTenantContext`) and redirects to /dashboard if the org
 * is not entitled to `feature`. A no-op in the free build (community = all-on); it only bites
 * when a cloud provider gates the feature off.
 *
 * UI gating is not enforcement: any WRITE a paid feature unlocks must re-check `can`/`limit`
 * in its own server action too (see R36.3 spec) — this guard protects a page, not a mutation.
 */
export async function requireFeature(feature: Feature): Promise<void> {
  const { orgId } = await getTenantContext();
  if (!(await can(orgId, feature))) redirect("/dashboard");
}
