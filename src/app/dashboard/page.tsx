import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Leaf, SignOut, User } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/cas/login");

  // Fetch fresh role name
  const role = session.user.roleId
    ? await prisma.role.findUnique({
        where: { id: session.user.roleId },
        select: { name: true },
      })
    : null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf size={18} weight="fill" className="text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              SEED Project Tracker
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <User size={14} weight="bold" className="text-muted-foreground" />
              <span
                className="text-xs text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {session.user.email}
              </span>
            </div>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <SignOut size={12} weight="bold" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20">
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Dashboard
        </p>
        <h1
          className="text-4xl text-foreground mb-10"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Welcome back.
        </h1>

        {/* Session info card — placeholder until Phase 2 */}
        <div className="rounded-xl border border-border bg-card p-7">
          <p
            className="text-xs text-muted-foreground uppercase tracking-widest mb-5"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Your account
          </p>
          <dl className="space-y-3">
            <div className="flex gap-6">
              <dt
                className="text-xs text-muted-foreground w-24 shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Email
              </dt>
              <dd className="text-sm text-foreground">{session.user.email}</dd>
            </div>
            <div className="flex gap-6">
              <dt
                className="text-xs text-muted-foreground w-24 shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Status
              </dt>
              <dd>
                <span className="status-on-track mono text-xs font-semibold px-2 py-0.5 rounded-md">
                  {session.user.status}
                </span>
              </dd>
            </div>
            <div className="flex gap-6">
              <dt
                className="text-xs text-muted-foreground w-24 shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Role
              </dt>
              <dd className="text-sm text-foreground">
                {role?.name ?? "Unassigned"}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Phase 2 (projects, deliverables, status form) coming next.
        </p>
      </main>
    </div>
  );
}
