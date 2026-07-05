import Link from "next/link";
import { getSigninBrand } from "@/lib/org";
import { getConfiguredOAuthProviders } from "@/lib/auth-provider";
import { signIn } from "@/auth";
import { BrandLockup } from "@/components/brand-lockup";
import { GoogleLogo, GithubLogo, ArrowLeft } from "@phosphor-icons/react/dist/ssr";

interface Props {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

const errorMessages: Record<string, string> = {
  invalid_link: "That sign-in link is invalid or has expired. Request a new one below.",
  AccessDenied: "That account's email domain isn't allowed here.",
};

const OAUTH_META = {
  google: { label: "Continue with Google", Icon: GoogleLogo },
  github: { label: "Continue with GitHub", Icon: GithubLogo },
} as const;

/**
 * The sign-in surface (R28.1 magic link + R33.2 OAuth). OAuth buttons render only
 * for providers whose credential env pair is configured (getConfiguredOAuthProviders,
 * shared with auth.ts); a stock install shows just the magic-link form.
 */
export default async function EmailSignInPage({ searchParams }: Props) {
  const { sent, error } = await searchParams;
  const org = await getSigninBrand();
  const oauthProviders = getConfiguredOAuthProviders();

  // One server action for every OAuth button; the provider comes from the form.
  async function oauthSignIn(formData: FormData) {
    "use server";
    const provider = formData.get("provider");
    if (provider === "google" || provider === "github") {
      await signIn(provider, { redirectTo: "/dashboard" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Back to landing (R33.3) */}
        <Link
          href="/"
          className="clickable inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-6"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={14} weight="bold" />
          Back
        </Link>

        <div className="mb-10">
          <BrandLockup org={org} variant="nav" />
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
                <p className="text-xs text-[var(--behind)] font-medium" data-testid="signin-error">
                  {errorMessages[error] ?? "An unexpected error occurred."}
                </p>
              </div>
            )}

            {oauthProviders.length > 0 && (
              <>
                <div className="space-y-2.5 mb-5" data-testid="oauth-buttons">
                  {oauthProviders.map((provider) => {
                    const { label, Icon } = OAUTH_META[provider];
                    return (
                      <form key={provider} action={oauthSignIn}>
                        <input type="hidden" name="provider" value={provider} />
                        <button
                          type="submit"
                          data-testid={`oauth-${provider}`}
                          className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card text-foreground text-sm font-medium py-2.5 hover:bg-muted transition-colors"
                        >
                          <Icon size={18} weight="bold" />
                          {label}
                        </button>
                      </form>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 mb-5" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  <span
                    className="text-xs text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    or
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
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
