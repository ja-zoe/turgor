import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signOut } from "@/auth";
import { UserStatus } from "@/generated/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant";
import { Sidebar } from "@/components/sidebar";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { prisma } from "@/lib/prisma";
import { getDisplayName } from "@/lib/utils";
import { getOrgSettings } from "@/lib/org";
import { cloudOrgUrl } from "@/lib/subdomain";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const status = ctx.membership.status;
  if (status === UserStatus.PENDING) redirect("/pending");
  if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) redirect("/signin");

  // Profile completion gate
  const dbUser = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { firstName: true, nickname: true, name: true, email: true },
  });
  if (!dbUser?.firstName) redirect("/profile/setup");

  const [permissions, org, orgRows] = await Promise.all([
    getUserPermissions(ctx.membership.roleId),
    getOrgSettings(ctx.orgId),
    prisma.organization.findMany({
      where: { id: { in: ctx.memberships.map((m) => m.orgId) } },
      select: { id: true, name: true },
    }),
  ]);
  // R39.3: on Turgor Cloud, switcher options carry each org's subdomain URL so selecting one
  // navigates there (URL matches the org). Self-host omits it → cookie switch.
  const cloudHost = process.env.TURGOR_CLOUD ? (await headers()).get("host") : null;
  const orgs = ctx.memberships.map((m) => ({
    id: m.orgId,
    name: orgRows.find((o) => o.id === m.orgId)?.name ?? "Organization",
    ...(cloudHost ? { url: cloudOrgUrl(m.slug, cloudHost) } : {}),
  }));
  const displayName = getDisplayName({
    firstName: dbUser.firstName,
    nickname: dbUser.nickname,
    name: dbUser.name,
    email: dbUser.email ?? ctx.email,
  });

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/dev-login" });
  }

  return (
    <TooltipProvider delay={200}>
    <div className="flex min-h-screen">
      <Sidebar
        userName={displayName}
        userEmail={ctx.email}
        appName={org.appName}
        orgName={org.orgName}
        orgLogoUrl={org.orgLogoUrl}
        periodLabel={org.periodLabel}
        permissions={permissions}
        orgs={orgs}
        activeOrgId={ctx.orgId}
        signOutAction={signOutAction}
      />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="lg:hidden h-14" />
        <ScrollReveal>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">{children}</div>
        </ScrollReveal>
      </main>
    </div>
    </TooltipProvider>
  );
}
