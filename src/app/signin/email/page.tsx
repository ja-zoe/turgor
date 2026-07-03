import Image from "next/image";
import { getOrgSettings } from "@/lib/org";

interface Props {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

const errorMessages: Record<string, string> = {
  invalid_link: "That sign-in link is invalid or has expired. Request a new one below.",
};

/**
 * R28.1 — magic-link request form. The form posts to /api/auth/email/request, which
 * always lands back here with ?sent=1 (neutral regardless of address validity — no
 * account enumeration). Reachable in any provider mode; middleware routes
 * unauthenticated users here only when AUTH_PROVIDER=email (R28.2).
 */
export default async function EmailSignInPage({ searchParams }: Props) {
  const { sent, error } = await searchParams;
  const org = await getOrgSettings();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-10">
          <Image
            src={org.orgLogoUrl}
            alt={org.orgName}
            width={24}
            height={24}
            unoptimized
            className="object-contain"
          />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {org.appFullName}
          </span>
        </div>

        <h1
          className="text-3xl text-foreground mb-2"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Sign in
        </h1>

        {sent ? (
          <div data-testid="magic-link-sent">
            <p className="text-sm text-muted-foreground mb-8">
              Check your email. If the address can sign in here, a single-use link is
              on its way — it expires in 15 minutes.
            </p>
            <a href="/signin/email" className="text-sm text-primary clickable">
              Use a different address
            </a>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-8">
              Enter your email and we&apos;ll send you a sign-in link.
            </p>

            {error && (
              <div className="rounded-md border border-[var(--behind-bg)] bg-[var(--behind-bg)] px-4 py-3 mb-6">
                <p className="text-xs text-[var(--behind)] font-medium" data-testid="magic-link-error">
                  {errorMessages[error] ?? "An unexpected error occurred."}
                </p>
              </div>
            )}

            <form method="POST" action="/api/auth/email/request" className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.edu"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                  data-testid="magic-link-email"
                />
              </div>

              <button
                type="submit"
                className="w-full cursor-pointer rounded-md bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/80 transition-colors"
              >
                Email me a sign-in link
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
