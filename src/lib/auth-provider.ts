import { prisma } from "@/lib/prisma";

/**
 * R28.1/R29.4: which sign-in mechanism this deployment uses. Chosen in Org
 * Settings (`Settings.authProvider`, default "email" — the product is no longer
 * SEED-first); the AUTH_PROVIDER env var, when set, overrides it (operator and
 * e2e escape hatch — it's how the email-mode test server is driven).
 *
 * This module touches the DB and is Node-only. The Edge proxy never calls it —
 * it redirects unauthenticated traffic to the static `/signin` dispatcher, which
 * resolves the provider here and forwards.
 */
export type AuthProvider = "cas" | "email";

export function envAuthProviderOverride(): AuthProvider | null {
  const v = process.env.AUTH_PROVIDER;
  return v === "email" || v === "cas" ? v : null;
}

export async function getAuthProvider(): Promise<AuthProvider> {
  const override = envAuthProviderOverride();
  if (override) return override;
  try {
    const row = await prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { authProvider: true },
    });
    return row?.authProvider === "cas" ? "cas" : "email";
  } catch {
    // Pre-seed / unreachable-DB bootstrap: fall back to the product default.
    return "email";
  }
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
