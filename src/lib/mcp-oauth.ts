import * as stytch from "stytch";
import * as jose from "jose";
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

const USER_SELECT = { id: true, email: true, roleId: true, status: true } as const;

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

/** Stytch API base for this project (test vs live keyed off the project_id prefix). */
function stytchApiBase(projectId: string): string {
  return projectId.startsWith("project-live-") ? "https://api.stytch.com" : "https://test.stytch.com";
}

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
/** Remote JWK set for this Stytch project — verifies the access token's signature. */
function getStytchJwks() {
  if (jwks) return jwks;
  const projectId = process.env.STYTCH_PROJECT_ID;
  if (!projectId) return null;
  jwks = jose.createRemoteJWKSet(
    new URL(`/v1/sessions/jwks/${projectId}`, stytchApiBase(projectId))
  );
  return jwks;
}

/**
 * Validate a Stytch-issued OAuth access token and resolve it to an ACTIVE SEED user, or
 * null. Never throws — a bad/expired/foreign token just yields null (→ 401).
 */
export async function verifyOAuthAccessToken(token: string): Promise<McpUser | null> {
  const sx = getStytch();
  if (!sx) return null;

  // Verify the access token directly against Stytch's project JWKS. We intentionally do NOT
  // use `idp.introspectTokenLocal` here: that helper only accepts the *session* JWT issuers
  // (`stytch.com/<project_id>` or the API base URL), whereas Connected-App OAuth access
  // tokens carry the IdP issuer — so it rejects a valid token with `unexpected "iss"`. The
  // project-scoped JWKS still proves the token was minted by *our* Stytch project; jose
  // enforces the signature + expiry. RBAC is re-checked per-user downstream.
  const jwkSet = getStytchJwks();
  if (!jwkSet) return null;
  let claimsRecord: Record<string, unknown>;
  try {
    const { payload } = await jose.jwtVerify(token, jwkSet);
    claimsRecord = payload as Record<string, unknown>;
  } catch (e) {
    console.error("[mcp-oauth] token verify failed:", (e as Error)?.message);
    return null;
  }

  // Stytch puts custom claims at the top level of the access token; an SDK-shaped nested
  // `custom_claims` object is also tolerated.
  const cc = (claimsRecord.custom_claims ?? {}) as Record<string, unknown>;
  const subject = (claimsRecord.sub as string | undefined) ?? null;

  // The CAS email may ride in the access token as a custom claim, but Stytch's *default*
  // access token does NOT carry email — it only has subject/scope/aud/iss. So try the claim
  // shapes first, then fall back to the Stytch user record keyed by `subject`, which JIT
  // provisioning populated with the CAS email via our Trusted Auth Token Profile.
  let email: string | null =
    (claimsRecord.email as string | undefined) ??
    (cc.email as string | undefined) ??
    (cc["https://seed/email"] as string | undefined) ??
    null;

  // The Stytch user's external_id mirrors our SEED user id (token_id → sub in the profile),
  // giving a second, email-independent way to map back to a SEED user.
  let externalId: string | null = null;
  if (subject && subject.startsWith("user-")) {
    try {
      const u = await sx.users.get({ user_id: subject });
      externalId = u.external_id ?? null;
      if (!email) {
        email = (u.emails.find((e) => e.verified)?.email ?? u.emails[0]?.email) ?? null;
      }
    } catch (e) {
      console.warn("[mcp-oauth] users.get fallback failed:", (e as Error)?.message);
    }
  }

  console.log("[mcp-oauth] verified access token", {
    subject,
    iss: claimsRecord.iss,
    scope: claimsRecord.scope,
    top_level_keys: Object.keys(claimsRecord),
    custom_claim_keys: Object.keys(cc),
    external_id: externalId,
    resolved_email: email ? email.replace(/(.{2}).*(@.*)/, "$1***$2") : null,
  });

  // Map to a SEED user: by email first, then by the SEED id carried in external_id / subject.
  let user = email
    ? await prisma.user.findUnique({ where: { email }, select: USER_SELECT })
    : null;
  if (!user) {
    // A SEED cuid (not a Stytch "user-…" id) may arrive as external_id or as the subject.
    const seedId = [externalId, subject].find((v) => v && !v.startsWith("user-"));
    if (seedId) {
      user = await prisma.user.findUnique({ where: { id: seedId }, select: USER_SELECT });
    }
  }

  if (!user || user.status !== "ACTIVE") {
    console.warn(
      "[mcp-oauth] no ACTIVE SEED user for the token (subject=" + subject + ", external_id=" + externalId + ")"
    );
    return null;
  }
  return { id: user.id, email: user.email, roleId: user.roleId };
}
