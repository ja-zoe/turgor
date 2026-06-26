import Link from "next/link";
import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge } from "@/components/status-badge";
import { ArrowRight, Folders, Plant } from "@phosphor-icons/react/dist/ssr";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManage = permissions.includes(Permission.MANAGE_PROJECTS);
  const canViewAll =
    permissions.includes(Permission.VIEW_ALL_PROJECTS) || canManage;

  const projects = canViewAll
    ? await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          semester: true,
          status: true,
          _count: { select: { deliverables: true, assignments: true } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      })
    : await prisma.project.findMany({
        where: {
          assignments: { some: { userId: user.id } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          semester: true,
          status: true,
          _count: { select: { deliverables: true, assignments: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Projects
          </p>
          <h1
            className="text-3xl text-foreground"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            All Projects
          </h1>
        </div>
        {canManage && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 hover:bg-primary/80 transition-colors"
          >
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <Folders size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">No projects found.</p>
          {canManage && (
            <Link
              href="/projects/new"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Create the first project
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Plant size={16} className="text-primary mt-0.5" weight="fill" />
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {project.semester} &middot; {project._count.deliverables} deliverable
                      {project._count.deliverables !== 1 ? "s" : ""} &middot;{" "}
                      {project._count.assignments} member
                      {project._count.assignments !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ProjectStatusBadge status={project.status} />
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground group-hover:text-foreground transition-colors"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
