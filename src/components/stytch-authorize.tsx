"use client";

import { useEffect, useMemo, useState } from "react";
import { createStytchUIClient, StytchProvider, IdentityProvider } from "@stytch/nextjs";

/**
 * Renders Stytch's OAuth consent UI on /oauth/authorize. Given our CAS-minted
 * `trustedAuthToken`, the IdentityProvider logs the user in (attestation) and runs the
 * OAuth authorization flow self-contained — it reads the OAuth request params (client_id,
 * redirect_uri, scope, state, PKCE) from the URL and redirects back to the client (ChatGPT)
 * with an auth code. The Stytch browser client is created client-side only (mount guard).
 * Any Stytch error is surfaced on the page (and logged) to make a misconfig diagnosable
 * without DevTools.
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
  const [err, setErr] = useState<string | null>(null);
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
      {err && (
        <pre
          data-testid="stytch-error"
          className="mb-4 whitespace-pre-wrap break-all rounded-md border border-[#A4503C]/20 bg-[#FDEBEC] p-3 text-xs text-[#A4503C]"
        >
          {err}
        </pre>
      )}
      <IdentityProvider
        authTokenParams={{ trustedAuthToken, tokenProfileID }}
        callbacks={{
          onError: (e) => {
            // The IDP consent screen fires NoCurrentSessionError on initial mount whenever
            // there's no pre-existing Stytch session — which is always the case here, since we
            // establish the session via trusted-token attestation that runs a beat later. It's
            // a benign race in the SDK, not a real failure, so swallow it. Genuine attestation
            // failures arrive with a different error name and still surface below.
            if ((e as { name?: string })?.name === "NoCurrentSessionError") {
              console.debug("[mcp-oauth] ignoring transient NoCurrentSessionError (pre-attest)");
              return;
            }
            console.error("[mcp-oauth] Stytch error", e);
            try {
              setErr(JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
            } catch {
              setErr(String((e as { message?: string })?.message ?? e));
            }
          },
        }}
      />
    </StytchProvider>
  );
}
