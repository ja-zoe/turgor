import { notFound, redirect } from "next/navigation";
import { requireAuth, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { submitStatusUpdate } from "@/lib/actions/status-updates";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function SubmitStatusUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, id);
  if (!membership || membership.role === "MEMBER") redirect(`/projects/${id}`);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, semester: true },
  });
  if (!project) notFound();

  // Default meeting date: next Monday (or today if it's Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const nextMeeting = new Date(now);
  nextMeeting.setDate(now.getDate() + daysUntilMonday);
  const defaultMeetingDate = nextMeeting.toISOString().split("T")[0];

  async function handleSubmit(formData: FormData) {
    "use server";
    await submitStatusUpdate(id, formData);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Status Update
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          {project.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{project.semester}</p>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Meeting Date *
          </label>
          <input
            name="meetingDate"
            type="date"
            required
            defaultValue={defaultMeetingDate}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Submissions after 24h before this date are marked late.
          </p>
        </div>

        {[
          { name: "plannedWork", label: "Planned Work for This Week", placeholder: "What did you plan to accomplish this week?" },
          { name: "actualProgress", label: "Actual Progress", placeholder: "What did you actually complete? What didn't happen?" },
          { name: "blockers", label: "Blockers", placeholder: "What is slowing you down? (Write 'None' if no blockers)" },
          { name: "nextWeekGoals", label: "Next Week's Goals", placeholder: "What will you commit to for next week?" },
        ].map(({ name, label, placeholder }) => (
          <div key={name}>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              {label} *
            </label>
            <textarea
              name={name}
              rows={3}
              required
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
            />
          </div>
        ))}

        {/* Help needed toggle */}
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              id="needsHelp"
              name="needsHelp"
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="needsHelp" className="text-sm font-medium text-foreground">
              I need help from the PM
            </label>
          </div>
          <textarea
            name="helpNeeded"
            rows={2}
            placeholder="Describe what help you need…"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton
            label="Submit Update"
            pendingLabel="Submitting…"
            className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
