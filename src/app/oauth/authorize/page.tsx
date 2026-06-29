import { requireAuth } from "@/lib/permissions";
import { mintTrustedAuthToken } from "@/lib/mcp-trusted-token";
import { StytchAuthorize } from "@/components/stytch-authorize";

/**
 * OAuth authorization endpoint for MCP hosts (ChatGPT), R17.2 Phase B. Lives outside the
 * (app) shell so there's no sidebar. Flow: CAS `requireAuth()` (the user is logged in and
 * netId-verified) → mint the trusted token (JWT #1) → Stytch's consent UI completes the
 * OAuth flow. This is what the Stytch dashboard "Authorization URL" should point at.
 */
export const dynamic = "force-dynamic";

export default async function AuthorizePage() {
  const user = await requireAuth(); // CAS — redirects to sign-in if needed; this binds identity
  const trustedAuthToken = await mintTrustedAuthToken({ id: user.id, email: user.email });

  const publicToken = process.env.STYTCH_PUBLIC_TOKEN;
  const tokenProfileID = process.env.STYTCH_TRUSTED_TOKEN_PROFILE_ID;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        {!trustedAuthToken || !publicToken || !tokenProfileID ? (
          <div className="text-center">
            <h1
              className="text-2xl text-foreground mb-2"
              style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
            >
              Connection unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              MCP OAuth isn&apos;t fully configured on this server. Use a personal access token from your
              Account page with a local client instead.
            </p>
          </div>
        ) : (
          <StytchAuthorize
            publicToken={publicToken}
            tokenProfileID={tokenProfileID}
            trustedAuthToken={trustedAuthToken}
          />
        )}
      </div>
    </div>
  );
}
