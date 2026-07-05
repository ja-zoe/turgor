import { redirect, notFound } from "next/navigation";
import { AuthError } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { signIn } from "@/auth";
import { mintHandoffToken } from "@/lib/handoff-token";
import { getSigninBrand } from "@/lib/org";

/**
 * Dev-only mock login (R33.1, replaces the CAS mock). Fail-closed: the page 404s
 * and the server action throws in production, so the *absence* of any config is
 * safe — no env var can open it (this closes BACKLOG SEC-1). Locally it mints an
 * email handoff token, exercising the same `authorize` email path as the magic
 * link (including the ALLOWED_EMAIL_DOMAINS gate).
 */
const IS_PROD = process.env.NODE_ENV === "production";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Sign-in failed (check ALLOWED_EMAIL_DOMAINS).",
  invalid_email: "Enter a valid email address.",
};

export default async function DevLoginPage({ searchParams }: Props) {
  if (IS_PROD) notFound();
  const { error } = await searchParams;
  const org = await getSigninBrand();

  async function login(formData: FormData) {
    "use server";
    if (process.env.NODE_ENV === "production") {
      throw new Error("dev mock login is disabled in production");
    }
    const email = (formData.get("email") as string)?.trim().toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      redirect("/dev-login?error=invalid_email");
    }

    const token = mintHandoffToken(email);

    try {
      await signIn("credentials", { token, redirectTo: "/dashboard" });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/dev-login?error=${err.type}`);
      }
      throw err; // rethrow NEXT_REDIRECT
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

        {/* Brand */}
        <div className="flex items-center gap-2 mb-10">
          <Image src={org.orgLogoUrl} alt={org.orgName} width={24} height={24} unoptimized className="object-contain" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {org.appFullName}
          </span>
        </div>

        {/* Heading */}
        <h1
          className="text-3xl text-foreground mb-2"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Enter any email to continue.
        </p>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-[var(--behind-bg)] bg-[var(--behind-bg)] px-4 py-3 mb-6">
            <p className="text-xs text-[var(--behind)] font-medium">
              {errorMessages[error] ?? "An unexpected error occurred."}
            </p>
          </div>
        )}

        {/* Form */}
        <form action={login} className="space-y-4">
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
              autoComplete="username"
              autoFocus
              placeholder="e.g. you@example.com"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <button
            type="submit"
            className="w-full cursor-pointer rounded-md bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/80 transition-colors"
          >
            Sign in
          </button>
        </form>

        {/* Dev mock indicator */}
        <p
          className="mt-6 text-xs text-muted-foreground text-center"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          dev mock — production builds 404 this page
        </p>
      </div>
    </div>
  );
}
