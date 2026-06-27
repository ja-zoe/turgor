import { notFound } from "next/navigation";
import { requireAuth, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSubtask } from "@/lib/actions/deliverables";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function NewSubtaskPage({
  params,
}: {
  params: Promise<{ id: string; did: string }>;
}) {
  const { id, did } = await params;
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, id);
  if (!membership) {
    // PM can still add subtasks — checked in action
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: did, projectId: id },
    include: {
      project: {
        select: {
          name: true,
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!deliverable) notFound();

  const members = deliverable.project.assignments.map((a) => a.user);

  async function handleSubmit(formData: FormData) {
    "use server";
    await createSubtask(did, formData);
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {deliverable.project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {deliverable.title}
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Add Subtask
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
            placeholder="e.g. Set up test rig"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Assigned To
            </label>
            <select
              name="assigneeId"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Due Date
            </label>
            <input
              name="dueDate"
              type="date"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Description (Markdown)
          </label>
          <MarkdownEditor name="description" rows={4} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton label="Add Subtask" pendingLabel="Adding…" className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
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
