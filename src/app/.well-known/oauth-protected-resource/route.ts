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
    scopes_supported: ["mcp"],
  });
}
