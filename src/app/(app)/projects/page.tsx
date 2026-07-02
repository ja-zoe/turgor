import Link from "next/link";
import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectsList } from "@/components/projects-list";
import { ArrowRight, Folders } from "@phosphor-icons/react/dist/ssr";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireAuth();
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const permissions = await getUserPermissions(user.roleId);
  const canManage = permissions.includes(Permission.MANAGE_PROJECTS);
  const canViewAll =
    permissions.includes(Permission.VIEW_ALL_PROJECTS) || canManage;

  const scopeWhere = canViewAll
    ? {}
    : { assignments: { some: { userId: user.id } } };
  const archivedWhere = showArchived
    ? { archivedAt: { not: null } }
    : { archivedAt: null };

  const select = {
    id: true,
    name: true,
    description: true,
    semester: true,
    status: true,
    archivedAt: true,
    _count: { select: { deliverables: true, assignments: true } },
  } as const;

  const [projects, archivedCount] = await Promise.all([
    prisma.project.findMany({
      where: { ...scopeWhere, ...archivedWhere },
      select,
      orderBy: canViewAll
        ? [{ status: "asc" }, { updatedAt: "desc" }]
        : { updatedAt: "desc" },
    }),
    prisma.project.count({ where: { ...scopeWhere, archivedAt: { not: null } } }),
  ]);

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
            {showArchived ? "Archived Projects" : "All Projects"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {archivedCount > 0 && (
            <Link
              href={showArchived ? "/projects" : "/projects?archived=1"}
              data-testid="archived-toggle"
              className="text-xs text-muted-foreground clickable-icon"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {showArchived ? "Active" : `Archived (${archivedCount})`}
            </Link>
          )}
          {canManage && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 hover:bg-primary/80 transition-colors"
            >
              New Project
            </Link>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <Folders size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">
            {showArchived ? "No archived projects." : "No projects found."}
          </p>
          {canManage && !showArchived && (
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
        <ProjectsList
          projects={projects.map((p) => ({ ...p, archived: p.archivedAt !== null }))}
          canManage={canManage}
        />
      )}
    </div>
  );
}
