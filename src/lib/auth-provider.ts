/**
 * R28.1: which sign-in mechanism this deployment uses. A deployment property, not
 * a Settings row — auth must work before DB-backed settings are reachable. CAS is
 * the default so SEED's deployment is untouched with AUTH_PROVIDER unset.
 */
export type AuthProvider = "cas" | "email";

export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "email" ? "email" : "cas";
}

/**
 * Allowlist gate for full-email identities (magic link). Empty ALLOWED_EMAIL_DOMAINS
 * means any domain — a community club can open sign-up while a campus club restricts
 * to its school domain. (The CAS path keeps its stricter historical semantics in
 * auth.ts: the CAS domain must be listed explicitly.)
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
