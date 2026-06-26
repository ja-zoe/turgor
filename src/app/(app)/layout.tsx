import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { UserStatus } from "@/generated/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { ScrollReveal } from "@/components/scroll-reveal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/cas/login");
  if (session.user.status === UserStatus.PENDING) redirect("/pending");
  if (session.user.status === UserStatus.SUSPENDED) redirect("/api/cas/login");

  const permissions = await getUserPermissions(session.user.roleId ?? null);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/dev-login" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={session.user.name ?? session.user.email ?? "User"}
        userEmail={session.user.email ?? ""}
        permissions={permissions}
        signOutAction={signOutAction}
      />
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Top spacing on mobile to clear the hamburger button */}
        <div className="lg:hidden h-14" />
        <ScrollReveal>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">{children}</div>
        </ScrollReveal>
      </main>
    </div>
  );
}
