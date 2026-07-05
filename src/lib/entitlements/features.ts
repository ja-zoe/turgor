/**
 * Entitlement vocabulary (set 36 — the seam the private turgor-cloud repo plugs into).
 *
 * These are the stable feature/limit keys the cloud provider maps plans onto. They
 * represent PREMIUM capabilities and deliberately do NOT map to any existing free
 * feature, so wiring a gate can never remove free-tier functionality. Adding a key is
 * a one-line change here plus a cloud-side mapping.
 */

/** Boolean premium capabilities. */
export type Feature =
  | "ADVANCED_ANALYTICS"
  | "SSO"
  | "AUDIT_LOG"
  | "DATA_EXPORT_API";

/** Numeric quota keys. A resolved limit of `null` means unlimited. */
export type LimitKey = "MAX_PROJECTS" | "MAX_MEMBERS";

export const ALL_FEATURES: readonly Feature[] = [
  "ADVANCED_ANALYTICS",
  "SSO",
  "AUDIT_LOG",
  "DATA_EXPORT_API",
];

export const ALL_LIMIT_KEYS: readonly LimitKey[] = ["MAX_PROJECTS", "MAX_MEMBERS"];
