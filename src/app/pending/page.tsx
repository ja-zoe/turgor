import { auth } from "@/auth";
import { signOut } from "@/auth";
import { Leaf, Clock, SignOut } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/dev-login");
  if (session.user.status === "ACTIVE") redirect("/dashboard");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-10">
          <Leaf size={20} weight="fill" className="text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SEED Project Tracker
          </span>
        </div>

        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-[var(--at-risk-bg)] flex items-center justify-center mb-6">
          <Clock size={24} weight="bold" className="text-[var(--at-risk)]" />
        </div>

        {/* Content */}
        <h1
          className="text-3xl text-foreground mb-3"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Awaiting approval
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          Your account is pending activation by the Project Manager.
        </p>
        <p
          className="text-xs text-muted-foreground mb-8"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {session.user.email}
        </p>

        <div className="rounded-xl border border-border bg-card p-5 mb-8">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The PM will be notified to approve your account. Once approved, you
            will have access to the tracker. You can refresh this page to check
            your status.
          </p>
        </div>

        {/* Sign out */}
        <form action={handleSignOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <SignOut size={14} weight="bold" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
