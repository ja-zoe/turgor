import * as stytch from "stytch";
import { prisma } from "@/lib/prisma";

/**
 * MCP OAuth (R17.2) — the *resource server* half. ChatGPT (and other OAuth MCP hosts)
 * present a Stytch-issued access token; we validate it locally and map it to an ACTIVE
 * SEED user, then the MCP route enforces that user's normal RBAC.
 *
 * This is a thin seam so the provider stays swappable: only `verifyOAuthAccessToken`
 * knows about Stytch. The static `/account` `mcpToken` path (local clients) is unchanged
 * and lives in the route.
 *
 * Identity binding (no impersonation): the token's email is CAS-verified — it originates
 * from the JWT our `/oauth/authorize` route mints *behind `requireAuth()`*, which Stytch
 * accepts via a Trusted Auth Token Profile and echoes back as a custom claim.
 */

export type McpUser = { id: string; email: string; roleId: string | null };

let client: stytch.Client | null = null;

function getStytch(): stytch.Client | null {
  if (client) return client;
  const project_id = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;
  if (!project_id || !secret) return null; // OAuth not configured → feature simply off
  client = new stytch.Client({ project_id, secret });
  return client;
}

/** True when the Stytch keys are present, i.e. the OAuth/ChatGPT path is enabled. */
export function oauthConfigured(): boolean {
  return !!(process.env.STYTCH_PROJECT_ID && process.env.STYTCH_SECRET);
}

/** Looks like a JWT (Stytch access tokens are JWTs) — cheap guard before introspection. */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Validate a Stytch-issued OAuth access token and resolve it to an ACTIVE SEED user, or
 * null. Never throws — a bad/expired/foreign token just yields null (→ 401).
 */
export async function verifyOAuthAccessToken(token: string): Promise<McpUser | null> {
  const sx = getStytch();
  if (!sx) return null;

  let email: string | null = null;
  try {
    const claims = await sx.idp.introspectTokenLocal(token);
    // Trusted Auth Token Profile is configured to pass the CAS email through as a custom
    // claim; accept the common shapes.
    const cc = claims.custom_claims ?? {};
    email = (cc.email as string | undefined) ?? (cc["https://seed/email"] as string | undefined) ?? null;
  } catch {
    return null;
  }
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, roleId: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, email: user.email, roleId: user.roleId };
}
