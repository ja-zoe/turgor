import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MpcTokenSection } from "./mcp-token-section";
import { ProfileSettingsForm } from "@/components/profile-settings-form";

export default async function AccountPage() {
  const user = await requireAuth();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mcpToken: true, firstName: true, lastName: true, nickname: true, email: true },
  });

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
      />

      <MpcTokenSection hasToken={!!dbUser?.mcpToken} appUrl={appUrl} />
    </div>
  );
}
