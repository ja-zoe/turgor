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
  let subject: string | null = null;
  try {
    const claims = await sx.idp.introspectTokenLocal(token);
    const claimsRecord = claims as unknown as Record<string, unknown>;
    const cc = (claims.custom_claims ?? {}) as Record<string, unknown>;
    subject = claims.subject ?? null;
    // The CAS email may surface as a top-level or custom claim depending on Stytch token
    // config — try the common shapes.
    email =
      (claimsRecord.email as string | undefined) ??
      (cc.email as string | undefined) ??
      (cc["https://seed/email"] as string | undefined) ??
      null;
    // Diagnostic (server logs only; email masked): shows what ChatGPT's token carries so we
    // can map it to a SEED user. Remove once the mapping is confirmed.
    console.log("[mcp-oauth] introspected access token", {
      subject,
      scope: claims.scope,
      top_level_keys: Object.keys(claimsRecord),
      custom_claim_keys: Object.keys(cc),
      resolved_email: email ? email.replace(/(.{2}).*(@.*)/, "$1***$2") : null,
    });
  } catch (e) {
    console.error("[mcp-oauth] introspect failed:", (e as Error)?.message);
    return null;
  }
  if (!email) {
    console.warn("[mcp-oauth] no email claim on the access token (subject=" + subject + ") — cannot map to a SEED user");
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, roleId: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    console.warn("[mcp-oauth] no ACTIVE SEED user for the token's email");
    return null;
  }
  return { id: user.id, email: user.email, roleId: user.roleId };
}
