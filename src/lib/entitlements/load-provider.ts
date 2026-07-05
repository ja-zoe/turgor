// No `server-only` guard here: this internal module is reachable only through index.ts,
// which carries the guard for the whole entitlements graph. Omitting it keeps the load
// logic unit-testable outside the Next bundler.
import { ALL_FEATURES, ALL_LIMIT_KEYS, type Feature, type LimitKey } from "@/lib/entitlements/features";
import type { EntitlementsProvider, OrgEntitlements } from "@/lib/entitlements/types";
import { communityProvider } from "@/lib/entitlements/community";

/**
 * Optional cloud provider load point (R36.2). Core loads `@turgor/cloud`'s entitlements
 * provider when `ENTITLEMENTS_PROVIDER` names it, else uses the community provider. The free
 * build has NO compile-time dependency on the cloud module.
 *
 * Failure policy is asymmetric on purpose (security — see R36.2 spec):
 *  - unset            → community all-on (the intended free tier).
 *  - set, won't load  → THROW at startup (fail-closed): a misconfigured commercial deploy
 *                       must be caught, never silently serve premium features for free.
 *  - set, resolve throws at request time → most-restrictive entitlements (deny premium),
 *                       never all-on.
 */

// Most-restrictive set: everything denied. Used when a configured provider throws mid-request.
const RESTRICTED: OrgEntitlements = {
  plan: "community",
  features: Object.fromEntries(ALL_FEATURES.map((f) => [f, false])) as Record<Feature, boolean>,
  limits: Object.fromEntries(ALL_LIMIT_KEYS.map((k) => [k, 0])) as Record<LimitKey, number | null>,
};

function isConformingModule(m: unknown): m is { entitlementsProvider: EntitlementsProvider } {
  const p = (m as { entitlementsProvider?: unknown })?.entitlementsProvider as
    | { getEntitlements?: unknown }
    | undefined;
  return typeof p?.getEntitlements === "function";
}

/** Wrap a configured provider so a per-request throw fails closed (deny), never open. */
function failClosed(provider: EntitlementsProvider): EntitlementsProvider {
  return {
    async getEntitlements(orgId: string): Promise<OrgEntitlements> {
      try {
        return await provider.getEntitlements(orgId);
      } catch (e) {
        console.error(
          "[entitlements] configured provider getEntitlements threw; denying premium:",
          e instanceof Error ? e.message : e,
        );
        return RESTRICTED;
      }
    },
  };
}

async function loadProvider(): Promise<EntitlementsProvider> {
  const spec = process.env.ENTITLEMENTS_PROVIDER;
  if (!spec) return communityProvider; // free build — all-on, zero cost.

  let mod: unknown;
  try {
    // Non-literal specifier so the bundler leaves this as a runtime import (no static
    // resolution of a module the free build doesn't have).
    mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ spec);
  } catch (e) {
    // Fail-closed at startup: do NOT fall back to community here.
    throw new Error(
      `ENTITLEMENTS_PROVIDER="${spec}" is set but failed to load: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (!isConformingModule(mod)) {
    throw new Error(
      `ENTITLEMENTS_PROVIDER="${spec}" loaded but does not export a conforming \`entitlementsProvider\` (needs an async getEntitlements).`,
    );
  }
  return failClosed(mod.entitlementsProvider);
}

/**
 * Resolved once at module init (process-global, stable). The resolver in index.ts awaits it.
 * A startup failure (misconfigured commercial deploy) surfaces here.
 */
export const activeProviderPromise: Promise<EntitlementsProvider> = loadProvider();
