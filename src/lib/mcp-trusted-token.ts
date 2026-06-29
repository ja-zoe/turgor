import { SignJWT, importJWK, type JWK } from "jose";

/**
 * The "trusted auth token" (JWT #1) for MCP OAuth (R17.2 / Stytch). This is NOT the OAuth
 * access token — it's the short-lived, app-signed assertion our `/oauth/authorize` route
 * hands to Stytch to say "this CAS-authenticated user is <email>". Stytch trusts it via a
 * Trusted Auth Token Profile that verifies it against our published JWKS.
 *
 * Asymmetric (RS256): the private key lives in `MCP_OAUTH_PRIVATE_KEY` (a JWK JSON string,
 * server-only); the public key is published at `/.well-known/jwks.json`. iss/aud/email/sub
 * are pinned to match the dashboard profile.
 */

const ALG = "RS256";

function loadPrivateJwk(): JWK | null {
  const raw = process.env.MCP_OAUTH_PRIVATE_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JWK;
  } catch {
    return null;
  }
}

/** Public JWK Set for `/.well-known/jwks.json` (private RSA params stripped). */
export function getPublicJwks(): { keys: JWK[] } {
  const jwk = loadPrivateJwk();
  if (!jwk || !jwk.n || !jwk.e) return { keys: [] };
  return {
    keys: [{ kty: "RSA", n: jwk.n, e: jwk.e, kid: jwk.kid, use: "sig", alg: ALG }],
  };
}

/** Mint the trusted token for a CAS-authenticated user, or null if OAuth isn't configured. */
export async function mintTrustedAuthToken(user: { id: string; email: string }): Promise<string | null> {
  const jwk = loadPrivateJwk();
  const iss = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const aud = process.env.STYTCH_PROJECT_ID;
  if (!jwk || !iss || !aud) return null;

  const key = await importJWK(jwk, ALG);
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: ALG, kid: jwk.kid })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

export function trustedTokenConfigured(): boolean {
  return !!(process.env.MCP_OAUTH_PRIVATE_KEY && process.env.STYTCH_PROJECT_ID);
}
