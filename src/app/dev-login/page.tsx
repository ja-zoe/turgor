import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import Image from "next/image";
import { signIn } from "@/auth";
import { mintHandoffToken } from "@/lib/handoff-token";

interface Props {
  searchParams: Promise<{ error?: string; service?: string }>;
}

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Sign-in failed. Please try again.",
  invalid_netid: "NetID must be letters and numbers only.",
  auth_failed: "Sign-in failed. Please try again.",
  no_ticket: "No CAS ticket received.",
  invalid_ticket: "CAS ticket validation failed.",
  cas_unreachable: "Could not reach the CAS server.",
};

export default async function DevLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const netId = (formData.get("netId") as string)?.trim().toLowerCase();

    if (!netId || !/^[a-z0-9]+$/.test(netId)) {
      redirect("/dev-login?error=invalid_netid");
    }

    const token = mintHandoffToken(netId);

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
        {/* Brand */}
        <div className="flex items-center gap-2 mb-10">
          <Image src="/seed-logo-transparent.png" alt="SEED" width={24} height={24} unoptimized className="object-contain" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SEED Project Tracker
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
          Enter your Rutgers NetID to continue.
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
              htmlFor="netId"
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              NetID
            </label>
            <input
              id="netId"
              name="netId"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="e.g. jav273"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/80 transition-colors"
          >
            Sign in with Rutgers NetID
          </button>
        </form>

        {/* Mock mode indicator */}
        <p
          className="mt-6 text-xs text-muted-foreground text-center"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          CAS mock mode — any NetID is accepted
        </p>
      </div>
    </div>
  );
}
