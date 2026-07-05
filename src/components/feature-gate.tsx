import type { ReactNode } from "react";
import { getTenantContext } from "@/lib/tenant";
import { can } from "@/lib/entitlements";
import type { Feature } from "@/lib/entitlements/features";

/**
 * Section-level entitlement gate (R36.3). An async **server component**: it resolves the
 * active org and checks `can(orgId, feature)` on the server, rendering `children` only when
 * entitled and `fallback` otherwise. Because the check is server-side, withheld content is
 * never sent to the client — there is no client-side flag to spoof.
 *
 * Free build (community provider) → always renders `children`. The gated path activates only
 * when a cloud provider is loaded (R36.2).
 */
export async function FeatureGate({
  feature,
  fallback = null,
  children,
}: {
  feature: Feature;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { orgId } = await getTenantContext();
  return (await can(orgId, feature)) ? <>{children}</> : <>{fallback}</>;
}
