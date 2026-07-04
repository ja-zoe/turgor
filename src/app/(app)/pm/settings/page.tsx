import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission, TriggerType, Channel, RecipientGroup } from "@/generated/prisma";
import { updateSettings, updateOrgSettings, createNotificationRule, toggleNotificationRule, deleteNotificationRule } from "@/lib/actions/settings";
import { getOrgSettings } from "@/lib/org";
import { THEME_PRESETS } from "@/lib/themes";
import { Bell, Buildings, Gauge, Trash } from "@phosphor-icons/react/dist/ssr";
import { SubmitButton } from "@/components/submit-button";
import { PendingIconButton } from "@/components/action-feedback";
import { LogoUploader } from "@/components/logo-uploader";
import { storageConfigured } from "@/lib/storage";
import Image from "next/image";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  MISSING_SUBMISSION: "Missing Project Standing",
  PROJECT_BEHIND: "Project Behind",
  ACTION_ITEM_DUE: "Action Item Due",
  GOAL_MISSED: "Weekly Goal Missed",
};

const CHANNEL_LABELS: Record<Channel, string> = {
  EMAIL: "Email",
  IN_APP: "In-App",
  BOTH: "Both",
};

const RECIPIENT_LABELS: Record<RecipientGroup, string> = {
  PM: "Project Manager",
  PROJECT_LEADS: "Project Leads",
  ACTION_OWNER: "Action Item Owner",
  ALL_ACTIVE: "All Active Users",
};

export default async function SettingsPage() {
  await requirePermission(Permission.CONFIGURE_NOTIFICATIONS);

  const [settings, rules, org] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.notificationRule.findMany({ orderBy: { createdAt: "asc" } }),
    getOrgSettings(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          PM Tools
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Organization Settings
        </h1>
      </div>

      {/* Organization */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Buildings size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Organization</h2>
        </div>
        {/* Logo upload lives outside the org form — forms can't nest (R29.1). */}
        <div className="p-5 bg-card border border-border rounded-xl mb-4">
          <p
            className="block text-xs text-muted-foreground mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Logo
          </p>
          <LogoUploader
            currentUrl={org.orgLogoUrl}
            orgName={org.orgName}
            configured={storageConfigured()}
          />
        </div>
        <form action={updateOrgSettings} className="p-5 bg-card border border-border rounded-xl space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Organization short name
              </label>
              <input
                name="orgName"
                defaultValue={org.orgName}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used everywhere the app names itself, e.g. &ldquo;{org.appName}&rdquo;.
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Full name
              </label>
              <input
                name="orgFullName"
                defaultValue={org.orgFullName}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-full-name"
              />
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                App name (optional)
              </label>
              <input
                name="appName"
                defaultValue={settings?.appName ?? ""}
                placeholder={org.appFullName}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-app-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown in the sidebar, browser tab, sign-in pages, and emails. Leave
                empty to use the short name above.
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Institution (optional)
              </label>
              <input
                name="orgInstitution"
                defaultValue={org.orgInstitution}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-institution"
              />
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Logo URL (advanced)
              </label>
              <input
                name="orgLogoUrl"
                defaultValue={org.orgLogoUrl}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-logo-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Prefer the upload control above; this accepts a /public path or any
                hosted image URL.
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Period label
              </label>
              <input
                name="periodLabel"
                defaultValue={org.periodLabel}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="org-period-label"
              />
              <p className="text-xs text-muted-foreground mt-1">
                What a project cycle is called — &ldquo;Semester&rdquo;, &ldquo;Quarter&rdquo;, &ldquo;Cycle&rdquo;…
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Theme
              </label>
              <div className="flex items-center gap-4 pt-1.5 flex-wrap" data-testid="org-theme">
                {THEME_PRESETS.map((preset) => (
                  <label key={preset.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="themePreset"
                      value={preset.id}
                      defaultChecked={org.themePreset === preset.id}
                      className="accent-primary cursor-pointer"
                      data-testid={`theme-${preset.id}`}
                    />
                    <span
                      aria-hidden
                      className="inline-block w-3.5 h-3.5 rounded-full border border-border"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span className="text-sm text-foreground">{preset.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Sets the color family for everyone. Each member chooses light or dark
                for themselves (toggle in the sidebar). Status colors stay the same —
                they carry meaning.
              </p>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2.5" data-testid="org-preview">
                <Image
                  src={org.orgLogoUrl}
                  alt={org.orgName}
                  width={24}
                  height={24}
                  unoptimized
                  className="object-contain"
                />
                <span className="text-sm font-medium text-foreground">{org.appName}</span>
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  sidebar preview
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2">
            <SubmitButton
              label="Save organization"
              pendingLabel="Saving…"
              className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors disabled:opacity-50"
            />
          </div>
        </form>
      </section>

      {/* Detection thresholds */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Detection Thresholds</h2>
        </div>
        <form action={updateSettings} className="p-5 bg-card border border-border rounded-xl space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Status submit window (days before a lead meeting)
              </label>
              <input
                type="number"
                name="statusSubmitWindowDays"
                defaultValue={settings?.statusSubmitWindowDays ?? 3}
                min={1}
                max={30}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="status-submit-window"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The &ldquo;Submit Project Standing&rdquo; button appears this many days before a project&apos;s lead meeting.
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Late submission window (days after a lead meeting)
              </label>
              <input
                type="number"
                name="statusLateWindowDays"
                defaultValue={settings?.statusLateWindowDays ?? 3}
                min={0}
                max={30}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="status-late-window"
              />
              <p className="text-xs text-muted-foreground mt-1">
                After a lead meeting, a standing can still be submitted (marked late) for this many days before it&apos;s considered missed.
              </p>
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Weeks behind milestone to flag
              </label>
              <input
                type="number"
                name="weeksBehindMilestone"
                defaultValue={settings?.weeksBehindMilestone ?? 1}
                min={1}
                max={12}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Consecutive missed goals to flag
              </label>
              <input
                type="number"
                name="missedGoalsInARow"
                defaultValue={settings?.missedGoalsInARow ?? 2}
                min={1}
                max={10}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="requireBoth"
                  defaultChecked={settings?.requireBoth ?? false}
                  className="rounded accent-primary w-4 h-4"
                />
                <div>
                  <p className="text-sm text-foreground font-medium">Require both conditions</p>
                  <p className="text-xs text-muted-foreground">
                    Both milestone lag and missed goals must be true to flag Behind.
                  </p>
                </div>
              </label>
            </div>
          </div>
          <div className="pt-2">
            <SubmitButton
              label="Save thresholds"
              pendingLabel="Saving…"
              className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors disabled:opacity-50"
            />
          </div>
        </form>
      </section>

      {/* Notification Rules */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notification Rules</h2>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">No rules configured.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden mb-4">
            {rules.map((rule, i) => (
              <div
                key={rule.id}
                className={`flex items-center gap-4 px-4 py-3 ${
                  i !== rules.length - 1 ? "border-b border-border" : ""
                } ${rule.enabled ? "" : "opacity-50"}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {TRIGGER_LABELS[rule.triggerType]} &middot;{" "}
                    {CHANNEL_LABELS[rule.channel]} &middot;{" "}
                    {RECIPIENT_LABELS[rule.recipients]}
                    {rule.thresholdHours != null && ` &middot; ${rule.thresholdHours}h`}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await toggleNotificationRule(rule.id, !rule.enabled);
                  }}
                >
                  <PendingIconButton
                    spinnerSize={12}
                    className={`cursor-pointer text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
                      rule.enabled
                        ? "border-[#588157] text-[#588157] hover:bg-[#EDF3EC]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </PendingIconButton>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteNotificationRule(rule.id);
                  }}
                >
                  <PendingIconButton
                    title="Delete rule"
                    spinnerSize={14}
                    className="text-muted-foreground clickable-danger disabled:opacity-50"
                  >
                    <Trash size={14} />
                  </PendingIconButton>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Add rule form */}
        <details className="border border-dashed border-border rounded-xl overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer text-sm text-muted-foreground clickable-icon list-none">
            + Add notification rule
          </summary>
          <form
            action={createNotificationRule}
            className="border-t border-border px-4 py-4 grid grid-cols-2 gap-4"
          >
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Rule name
              </label>
              <input
                name="name"
                required
                placeholder="e.g. Remind leads before deadline"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Trigger
              </label>
              <select
                name="triggerType"
                required
                className="w-full cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Channel
              </label>
              <select
                name="channel"
                required
                className="w-full cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Recipients
              </label>
              <select
                name="recipients"
                required
                className="w-full cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.entries(RECIPIENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Threshold hours (optional)
              </label>
              <input
                type="number"
                name="thresholdHours"
                placeholder="e.g. 24"
                min={1}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="col-span-2">
              <SubmitButton
                label="Add rule"
                pendingLabel="Adding…"
                successLabel="Added"
                className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors disabled:opacity-50"
              />
            </div>
          </form>
        </details>

        <p
          className="mt-4 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Cron endpoint: <code className="bg-muted px-1 py-0.5 rounded">POST /api/cron/notifications</code>
          {" "}(Bearer token: <code className="bg-muted px-1 py-0.5 rounded">CRON_SECRET</code>).
          Run locally: <code className="bg-muted px-1 py-0.5 rounded">pnpm notifications:run</code>
        </p>
      </section>
    </div>
  );
}
