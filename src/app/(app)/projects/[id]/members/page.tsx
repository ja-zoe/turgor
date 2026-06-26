import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission, ProjectMemberRole } from "@/generated/prisma";
import { assignMember, removeMember } from "@/lib/actions/projects";
import { ArrowLeft, Trash } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission(Permission.MANAGE_PROJECTS);

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!project) notFound();

  const allUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const assignedIds = new Set(project.assignments.map((a) => a.userId));
  const unassigned = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {project.name}
        </Link>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Manage Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{project.name}</p>
      </div>

      {/* Current members */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Current Members</h2>
        {project.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {project.assignments.map((a) => (
              <div
                key={a.userId}
                className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {a.user.name ?? a.user.email.split("@")[0]}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.user.email} &middot; {a.role.toLowerCase()}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await removeMember(id, a.userId);
                  }}
                >
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-[#A4503C] transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add member */}
      {unassigned.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Add Member</h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              const userId = formData.get("userId") as string;
              const role = formData.get("role") as ProjectMemberRole;
              await assignMember(id, userId, role);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                User
              </label>
              <select
                name="userId"
                required
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <option value="">Select a user…</option>
                {unassigned.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email.split("@")[0]} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                Project Role
              </label>
              <select
                name="role"
                required
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <option value={ProjectMemberRole.LEAD}>Lead</option>
                <option value={ProjectMemberRole.SUBLEAD}>Sub-lead</option>
                <option value={ProjectMemberRole.MEMBER}>Member</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors"
            >
              Add to Project
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
