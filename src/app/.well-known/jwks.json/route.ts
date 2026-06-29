import { getPublicJwks } from "@/lib/mcp-trusted-token";

/**
 * Public JWKS for the MCP "trusted auth token" (JWT #1). Stytch's Trusted Auth Token
 * Profile fetches this to verify the JWTs our /oauth/authorize route mints. Served at
 * /.well-known/jwks.json. Empty until MCP_OAUTH_PRIVATE_KEY is set.
 */
export function GET() {
  return Response.json(getPublicJwks());
}
