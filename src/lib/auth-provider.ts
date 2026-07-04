/**
 * Email/identity gating helpers. Since R33.1 there is only one sign-in family —
 * magic link plus optional Google/GitHub OAuth (R33.2), chosen per deployment via
 * env, not per org in the DB — so the old per-org provider selection logic is gone.
 */

/**
 * Allowlist gate for full-email identities (magic link + OAuth + dev mock). Empty
 * ALLOWED_EMAIL_DOMAINS means any domain — a community club can open sign-up while
 * a campus club restricts to its school domain.
 */
export function isEmailDomainAllowed(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  if (!domain) return false;
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    // R33.4: strip wrapping quotes per entry — Vercel stores an empty mandatory
    // field as the literal string `""`, which otherwise becomes an unmatchable
    // "domain" and rejects every sign-in. A pasted `"myschool.edu"` is normalized too.
    .map((d) => d.trim().replace(/^["']+|["']+$/g, "").toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(domain);
}

/**
 * R33.2: which OAuth providers this deployment has configured, by env pair. A
 * provider's button renders (and its NextAuth provider is wired) only when both
 * halves of its credential pair are present. Single source shared by `auth.ts`
 * (provider list) and the sign-in page (button list) so they can't drift.
 */
export function getConfiguredOAuthProviders(): ("google" | "github")[] {
  const providers: ("google" | "github")[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push("google");
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push("github");
  return providers;
}

/**
 * e2e hook: skip Resend delivery and hand the sign-in link back to the caller.
 * Never active in production builds regardless of the env var.
 */
export function isEmailTestCapture(): boolean {
  return (
    process.env.AUTH_EMAIL_TEST_CAPTURE === "1" && process.env.NODE_ENV !== "production"
  );
}
