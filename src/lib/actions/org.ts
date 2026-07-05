"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTenantContext, ACTIVE_ORG_COOKIE } from "@/lib/tenant";

/**
 * Switch the active org (R35.2). Validates that the caller actually belongs to the
 * target org before setting the `turgor-active-org` cookie — never trust a
 * client-supplied org id. A non-member request is a no-op error.
 */
export async function switchOrg(orgId: string): Promise<void> {
  const ctx = await getTenantContext();
  if (!ctx.memberships.some((m) => m.orgId === orgId)) {
    throw new Error("Not a member of that organization");
  }
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
