import { notFound } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { updateActionItem } from "@/lib/actions/action-items";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function EditActionItemPage({
  params,
}: {
  params: Promise<{ id: string; aid: string }>;
}) {
  const { id, aid } = await params;
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const membership = await getProjectMembership(user.id, id);

  const canEdit =
    permissions.includes(Permission.ASSIGN_ACTION_ITEMS) ||
    membership?.role === "LEAD" ||
    membership?.role === "SUBLEAD";

  if (!canEdit) notFound();

  const item = await prisma.actionItem.findUnique({
    where: { id: aid, projectId: id },
    include: {
      project: {
        select: {
          name: true,
          assignments: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!item) notFound();

  const members = item.project.assignments.map((a) => a.user);

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {item.project.name}
        </Link>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Edit Action Item
        </h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateActionItem(aid, formData);
        }}
        className="space-y-6"
      >
        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Description *
          </label>
          <textarea
            name="description"
            required
            rows={3}
            defaultValue={item.description}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Owner
            </label>
            <select
              name="ownerId"
              defaultValue={item.ownerId ?? ""}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <option value="">No owner</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Deadline
            </label>
            <input
              name="deadline"
              type="date"
              defaultValue={item.deadline ? item.deadline.toISOString().slice(0, 10) : ""}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
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
