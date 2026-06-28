import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission, TimelineStatus } from "@/generated/prisma";
import { updateDeliverable } from "@/lib/actions/deliverables";

const STATUS_LABELS: Record<TimelineStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
};
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function EditDeliverablePage({
  params,
}: {
  params: Promise<{ id: string; did: string }>;
}) {
  const { id, did } = await params;
  await requirePermission(Permission.MANAGE_MILESTONES);

  const [deliverable, allDeliverables] = await Promise.all([
    prisma.deliverable.findUnique({
      where: { id: did, projectId: id },
      include: {
        project: { select: { name: true } },
        _count: { select: { subtasks: true } },
      },
    }),
    prisma.deliverable.findMany({
      where: { projectId: id, group: { not: null } },
      select: { group: true },
      distinct: ["group"],
    }),
  ]);
  if (!deliverable) notFound();

  const existingGroups = allDeliverables.map((d) => d.group).filter(Boolean) as string[];

  async function handleSubmit(formData: FormData) {
    "use server";
    await updateDeliverable(did, formData);
  }

  const targetStr = deliverable.targetDate.toISOString().split("T")[0];
  const startStr = deliverable.startDate?.toISOString().split("T")[0] ?? "";

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {deliverable.project.name}
        </Link>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Edit Deliverable
        </h1>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Title *
          </label>
          <input
            name="title"
            type="text"
            required
            defaultValue={deliverable.title}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Status
            </label>
            {deliverable._count.subtasks > 0 ? (
              <p
                className="text-sm text-muted-foreground px-3 py-2.5 rounded-md border border-border/50 bg-muted/40"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {STATUS_LABELS[deliverable.status]} — auto-derived from subtasks
              </p>
            ) : (
              <select
                name="status"
                defaultValue={deliverable.status}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <option value={TimelineStatus.NOT_STARTED}>Not Started</option>
                <option value={TimelineStatus.IN_PROGRESS}>In Progress</option>
                <option value={TimelineStatus.BLOCKED}>Blocked</option>
                <option value={TimelineStatus.COMPLETE}>Complete</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Group
            </label>
            <input
              name="group"
              type="text"
              list="group-suggestions"
              defaultValue={deliverable.group ?? ""}
              placeholder="e.g. Software"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
            <datalist id="group-suggestions">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Start Date
            </label>
            <input
              name="startDate"
              type="date"
              defaultValue={startStr}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Target Date *
            </label>
            <input
              name="targetDate"
              type="date"
              required
              defaultValue={targetStr}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Description & Acceptance Criteria (Markdown)
          </label>
          <MarkdownEditor
            name="description"
            defaultValue={deliverable.description ?? ""}
            rows={8}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton label="Save Changes" pendingLabel="Saving…" className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
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
