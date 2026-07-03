import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org";
import { MpcTokenSection } from "./mcp-token-section";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { SubmitButton } from "@/components/submit-button";
import { updateEmailNotifications } from "@/lib/actions/account";

export default async function AccountPage() {
  const user = await requireAuth();
  const org = await getOrgSettings();
  const [dbUser, connections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { mcpToken: true, firstName: true, lastName: true, nickname: true, email: true, emailNotifications: true },
    }),
    prisma.mcpConnection.findMany({
      where: { userId: user.id },
      orderBy: { lastSeenAt: "desc" },
      select: { type: true, label: true, lastSeenAt: true },
    }),
  ]);

  const appUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Account
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Settings
        </h1>
      </div>

      <ProfileSettingsForm
        firstName={dbUser?.firstName ?? ""}
        lastName={dbUser?.lastName ?? ""}
        nickname={dbUser?.nickname ?? ""}
        email={dbUser?.email ?? user.email}
        emailNote={`Managed by ${org.signInLabel} sign-in — can't be changed here.`}
      />

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">Notifications</h2>
        <div className="p-5 bg-card border border-border rounded-xl">
          <form action={updateEmailNotifications} className="space-y-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="emailNotifications"
                defaultChecked={dbUser?.emailNotifications ?? true}
                className="mt-0.5 rounded accent-primary"
                data-testid="email-notifications-toggle"
              />
              <span className="min-w-0">
                <span className="block text-sm text-foreground">Email me notifications</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Reminders, project alerts, and action-item notices by email. In-app
                  notifications (the bell) are always on.
                </span>
              </span>
            </label>
            <SubmitButton
              label="Save"
              pendingLabel="Saving…"
              successLabel="Saved"
              className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50"
            />
          </form>
        </div>
      </section>

      <MpcTokenSection
        hasToken={!!dbUser?.mcpToken}
        orgName={org.orgName}
        appUrl={appUrl}
        connections={connections.map((c) => ({
          type: c.type,
          label: c.label,
          lastSeenAt: c.lastSeenAt.toISOString(),
        }))}
      />
    </div>
  );
}
