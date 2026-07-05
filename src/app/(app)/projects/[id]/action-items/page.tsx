import { forOrg } from "@/lib/tenant-db";
import { getProjectAccess, listSwitcherProjects, toActionItemRows } from "@/lib/project-views";
import { ProjectContextSwitcher } from "@/components/project-context-switcher";
import { ActionItemsSection } from "@/components/action-items-section";
import { ArchivedBadge } from "@/components/status-badge";
import { getDisplayName } from "@/lib/utils";

/**
 * R30.2 — the project's full action-items workspace on its own page. Same gates
 * and component as the project page's section (via lib/project-views); the
 * heading's project name is the searchable switcher from R30.1.
 */
export default async function ProjectActionItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getProjectAccess(id);
  const db = forOrg(access.user.orgId);
  const [items, switcherProjects] = await Promise.all([
    db.actionItem.findMany({
      where: { projectId: id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        owner: { select: { id: true, firstName: true, nickname: true, name: true, email: true } },
      },
    }),
    listSwitcherProjects(access),
  ]);
  const openCount = items.filter((i) => i.status === "OPEN").length;

  return (
    <div className="space-y-8">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Action Items{openCount > 0 ? ` — ${openCount} open` : ""}
        </p>
        <div className="flex items-center gap-3">
          <ProjectContextSwitcher
            current={{ id, name: access.project.name }}
            projects={switcherProjects}
            subPath="action-items"
            suffix="Action Items"
          />
          {access.project.archivedAt && <ArchivedBadge />}
        </div>
      </div>

      <section>
        <ActionItemsSection
          projectId={id}
          items={toActionItemRows(items)}
          assignees={access.project.assignments.map((a) => ({
            id: a.userId,
            name: getDisplayName(a.user),
          }))}
          canCreate={access.canCreateActionItem}
          canClose={access.canCloseActionItemsHere}
          currentUserId={access.user.id}
        />
      </section>
    </div>
  );
}
