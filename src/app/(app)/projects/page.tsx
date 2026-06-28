import Link from "next/link";
import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectsList } from "@/components/projects-list";
import { ArrowRight, Folders } from "@phosphor-icons/react/dist/ssr";

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
        <ProjectsList projects={projects} canManage={canManage} />
      )}
    </div>
  );
}
