import { notFound, redirect } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { updateSubtask } from "@/lib/actions/deliverables";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getDisplayName } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETE", label: "Complete" },
];

export default async function EditSubtaskPage({
  params,
}: {
  params: Promise<{ id: string; did: string; sid: string }>;
}) {
  const { id, did, sid } = await params;
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const membership = await getProjectMembership(user.id, id);

  const canEdit =
    permissions.includes(Permission.MANAGE_MILESTONES) ||
    membership?.role === "LEAD" ||
    membership?.role === "SUBLEAD";

  if (!canEdit) notFound();

  const subtask = await prisma.subtask.findUnique({
    where: { id: sid, deliverableId: did },
    include: {
      deliverable: {
        select: {
          title: true,
          projectId: true,
          project: {
            select: {
              name: true,
              assignments: {
                include: { user: { select: { id: true, name: true, firstName: true, nickname: true, email: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!subtask || subtask.deliverable.projectId !== id) notFound();

  const members = subtask.deliverable.project.assignments.map((a) => a.user);

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {subtask.deliverable.project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {subtask.deliverable.title}
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Edit Subtask
        </h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateSubtask(sid, formData);
          redirect(`/projects/${id}`);
        }}
        className="space-y-6"
      >
        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Title *
          </label>
          <input
            name="title"
            type="text"
            required
            defaultValue={subtask.title}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Status
            </label>
            <select
              name="status"
              defaultValue={subtask.status}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Assigned To
            </label>
            <select
              name="assigneeId"
              defaultValue={subtask.assigneeId ?? ""}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getDisplayName(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Due Date
          </label>
          <input
            name="dueDate"
            type="date"
            defaultValue={subtask.dueDate ? subtask.dueDate.toISOString().slice(0, 10) : ""}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Description (Markdown)
          </label>
          <MarkdownEditor name="description" defaultValue={subtask.description ?? ""} rows={4} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton
            label="Save Changes"
            pendingLabel="Saving…"
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
