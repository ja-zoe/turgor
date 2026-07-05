import { forOrg } from "@/lib/tenant-db";
import { getProjectAccess, listSwitcherProjects, toSortableDeliverables } from "@/lib/project-views";
import { ProjectContextSwitcher } from "@/components/project-context-switcher";
import { SortableDeliverables } from "@/components/sortable-deliverables";
import { ArchivedBadge } from "@/components/status-badge";
import { deleteDeliverable } from "@/lib/actions/deliverables";

/**
 * R30.1 — the project's full deliverables workspace on its own page. Same gates,
 * component, and props as the project page's section (via lib/project-views), so
 * the surfaces can't drift; the heading's project name is a searchable switcher.
 */
export default async function ProjectDeliverablesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getProjectAccess(id);
  const db = forOrg(access.user.orgId);
  const [deliverables, switcherProjects] = await Promise.all([
    db.deliverable.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
      include: {
        subtasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            assignee: {
              select: { id: true, firstName: true, nickname: true, name: true, email: true },
            },
          },
        },
      },
    }),
    listSwitcherProjects(access),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Deliverables
        </p>
        <div className="flex items-center gap-3">
          <ProjectContextSwitcher
            current={{ id, name: access.project.name }}
            projects={switcherProjects}
            subPath="deliverables"
            suffix="Deliverables"
          />
          {access.project.archivedAt && <ArchivedBadge />}
        </div>
      </div>

      <section>
        <SortableDeliverables
          projectId={id}
          canManage={access.canManageMilestones || access.isLeadHere}
          canEdit={access.canManageMilestones || !!access.membership}
          userId={access.user.id}
          members={access.project.assignments.map((a) => a.user)}
          deliverables={toSortableDeliverables(deliverables)}
          deleteDeliverableAction={async (deliverableId: string) => {
            "use server";
            await deleteDeliverable(deliverableId);
          }}
        />
      </section>
    </div>
  );
}
