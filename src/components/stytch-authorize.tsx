"use client";

import { useEffect, useMemo, useState } from "react";
import { createStytchUIClient, StytchProvider, IdentityProvider } from "@stytch/nextjs";

/**
 * Renders Stytch's OAuth consent UI on /oauth/authorize. Given our CAS-minted
 * `trustedAuthToken`, the IdentityProvider logs the user in (attestation) and runs the
 * OAuth authorization flow self-contained — it reads the OAuth request params (client_id,
 * redirect_uri, scope, state, PKCE) from the URL and redirects back to the client (ChatGPT)
 * with an auth code. The Stytch browser client is created client-side only (mount guard).
 */
export function StytchAuthorize({
  publicToken,
  tokenProfileID,
  trustedAuthToken,
}: {
  publicToken: string;
  tokenProfileID: string;
  trustedAuthToken: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stytch = useMemo(
    () => (mounted ? createStytchUIClient(publicToken) : null),
    [mounted, publicToken]
  );

  if (!mounted || !stytch) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <StytchProvider stytch={stytch}>
      <IdentityProvider authTokenParams={{ trustedAuthToken, tokenProfileID }} />
    </StytchProvider>
  );
}
