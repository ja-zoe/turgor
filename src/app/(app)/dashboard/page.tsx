import Link from "next/link";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge } from "@/components/status-badge";
import {
  ArrowRight,
  ClipboardText,
  Folders,
  Plant,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

export default async function DashboardPage() {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManageProjects = permissions.includes(Permission.MANAGE_PROJECTS);

  // Projects the user is assigned to
  const assignments = await prisma.projectAssignment.findMany({
    where: { userId: user.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          semester: true,
          status: true,
          _count: { select: { deliverables: true } },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  // All projects if PM
  const allProjects = canManageProjects
    ? await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          semester: true,
          status: true,
          _count: { select: { deliverables: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : null;

  const myProjects = assignments.map((a) => a.project);

  // Most recent status update per my project
  const statusUpdateMap: Record<string, Date | null> = {};
  for (const p of myProjects) {
    const latest = await prisma.statusUpdate.findFirst({
      where: { projectId: p.id, submittedById: user.id },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    });
    statusUpdateMap[p.id] = latest?.submittedAt ?? null;
  }

  const displayName = user.name ?? user.email;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Dashboard
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Good to see you, {displayName}.
        </h1>
      </div>

      {/* My Projects */}
      {myProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">My Projects</h2>
          </div>
          <div className="grid gap-3">
            {myProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Plant size={16} className="text-primary" weight="fill" />
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {project.name}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {project.semester} &middot; {project._count.deliverables} deliverable
                      {project._count.deliverables !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ProjectStatusBadge status={project.status} />
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground group-hover:text-foreground transition-colors"
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* Submit status update CTAs */}
          <div className="mt-4 grid gap-2">
            {myProjects.map((project) => {
              const lastSubmitted = statusUpdateMap[project.id];
              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-4 py-3 bg-[#FBF3DB]/60 border border-[#C99846]/20 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardText size={14} className="text-[#C99846]" weight="fill" />
                    <span className="text-foreground font-medium">{project.name}</span>
                    {lastSubmitted ? (
                      <span
                        className="text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}
                      >
                        last update {lastSubmitted.toLocaleDateString()}
                      </span>
                    ) : (
                      <span
                        className="text-[#C99846]"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}
                      >
                        no update yet
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/projects/${project.id}/status/new`}
                    className="text-xs font-medium text-[#C99846] hover:text-[#A4503C] transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Submit update
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PM: All Projects */}
      {canManageProjects && allProjects && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">All Projects</h2>
            <Link
              href="/projects/new"
              className="text-xs font-medium text-primary hover:text-primary/70 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              + New project
            </Link>
          </div>
          {allProjects.length === 0 ? (
            <div className="p-8 border border-dashed border-border rounded-xl text-center">
              <Folders size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No projects yet.</p>
              <Link
                href="/projects/new"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                Create the first project
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {allProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {project.name}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {project.semester}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {project.status === "BEHIND" && (
                      <Warning size={14} className="text-[#A4503C]" weight="fill" />
                    )}
                    <ProjectStatusBadge status={project.status} />
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground group-hover:text-foreground transition-colors"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No projects */}
      {myProjects.length === 0 && !canManageProjects && (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <Plant size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">
            You haven&apos;t been assigned to any projects yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ask your Project Manager to add you to a project.
          </p>
        </div>
      )}
    </div>
  );
}
