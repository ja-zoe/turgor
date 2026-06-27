import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { UserStatus } from "@/generated/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { ScrollReveal } from "@/components/scroll-reveal";
import { prisma } from "@/lib/prisma";
import { getDisplayName } from "@/lib/utils";
import { ChatWidget } from "@/components/chat-widget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/cas/login");
  if (session.user.status === UserStatus.PENDING) redirect("/pending");
  if (session.user.status === UserStatus.SUSPENDED) redirect("/api/cas/login");

  // Profile completion gate
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, nickname: true, name: true, email: true },
  });
  if (!dbUser?.firstName) redirect("/profile/setup");

  const permissions = await getUserPermissions(session.user.roleId ?? null);
  const displayName = getDisplayName({
    firstName: dbUser.firstName,
    nickname: dbUser.nickname,
    name: dbUser.name,
    email: dbUser.email ?? session.user.email ?? "",
  });

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/dev-login" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={displayName}
        userEmail={session.user.email ?? ""}
        permissions={permissions}
        signOutAction={signOutAction}
      />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="lg:hidden h-14" />
        <ScrollReveal>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">{children}</div>
        </ScrollReveal>
      </main>
      <ChatWidget />
    </div>
  );
}
