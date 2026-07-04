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
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(domain);
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
