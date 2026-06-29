import { NextRequest } from "next/server";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP server. MCP/OAuth hosts
 * (ChatGPT) read this to discover the Authorization Server (our Stytch project). Served at
 * /.well-known/oauth-protected-resource.
 */
export function GET(req: NextRequest) {
  const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const authServer = process.env.STYTCH_OAUTH_AUTHORIZATION_SERVER?.replace(/\/$/, "");

  return Response.json({
    resource: `${base}/api/mcp`,
    authorization_servers: authServer ? [authServer] : [],
    bearer_methods_supported: ["header"],
    // Stytch's built-in OIDC scopes (no custom RBAC policy needed). A custom `mcp` scope
    // would require defining Resources/Permissions in Stytch RBAC; we don't need it —
    // access is enforced server-side per the resolved SEED user. offline_access → refresh.
    scopes_supported: ["openid", "email", "offline_access"],
  });
}
