import { notFound, redirect } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { createDeliverable } from "@/lib/actions/deliverables";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function NewDeliverablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A project lead/sublead can add deliverables to their own project; otherwise
  // the PM-level MANAGE_MILESTONES permission is required.
  const user = await requireAuth();
  const membership = await getProjectMembership(user.id, id);
  const isLeadHere = membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  if (!isLeadHere) {
    const permissions = await getUserPermissions(user.roleId);
    if (!permissions.includes(Permission.MANAGE_MILESTONES)) redirect(`/projects/${id}`);
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      deliverables: {
        select: { group: true },
        distinct: ["group"],
        where: { group: { not: null } },
      },
    },
  });
  if (!project) notFound();

  // Existing group names for datalist suggestions
  const existingGroups = project.deliverables
    .map((d) => d.group)
    .filter(Boolean) as string[];

  async function handleSubmit(formData: FormData) {
    "use server";
    await createDeliverable(id, formData);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground clickable mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Deliverables
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Add Deliverable
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
            placeholder="e.g. Prototype validated"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Group
            <span className="ml-2 text-muted-foreground/60 normal-case font-normal tracking-normal">optional — e.g. Software, Hardware, Marketing</span>
          </label>
          <input
            name="group"
            type="text"
            list="group-suggestions"
            placeholder="e.g. Software"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
          <datalist id="group-suggestions">
            {existingGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Start Date
            </label>
            <input
              name="startDate"
              type="date"
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
            placeholder={`## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Notes\nAdditional context…`}
            rows={8}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton label="Add Deliverable" pendingLabel="Adding…" className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground clickable-icon"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
