import Link from "next/link";
import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { Check, ListChecks, ArrowClockwise, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { closeActionItem, reopenActionItem } from "@/lib/actions/action-items";
import { ActionItemModal } from "@/components/action-item-modal";
import { getDisplayName, formatDateOnly } from "@/lib/utils";

export default async function AllActionItemsPage() {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManage = permissions.includes(Permission.MANAGE_PROJECTS);
  const canCloseAll = permissions.includes(Permission.CLOSE_ACTION_ITEMS);
  const canAssign = permissions.includes(Permission.ASSIGN_ACTION_ITEMS);

  // PM sees all; others see only items they own or are on their projects
  const items = await prisma.actionItem.findMany({
    where: canManage
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            {
              project: {
                assignments: { some: { userId: user.id } },
              },
            },
          ],
        },
    orderBy: [{ status: "asc" }, { carriedOver: "desc" }, { createdAt: "desc" }],
    include: {
      owner: { select: { id: true, name: true, firstName: true, nickname: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const openItems = items.filter((i) => i.status === "OPEN");
  const doneItems = items.filter((i) => i.status === "DONE");

  // Owner options for the edit modal, per project (only needed when the user can edit).
  const projectIds = [...new Set(items.map((i) => i.project.id))];
  const assignments =
    canAssign && projectIds.length
      ? await prisma.projectAssignment.findMany({
          where: { projectId: { in: projectIds } },
          include: { user: { select: { id: true, name: true, firstName: true, nickname: true, email: true } } },
        })
      : [];
  const assigneesByProject: Record<string, { id: string; name: string }[]> = {};
  for (const a of assignments) {
    (assigneesByProject[a.projectId] ??= []).push({ id: a.userId, name: getDisplayName(a.user) });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl text-foreground mb-1"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Action Items
        </h1>
        <p className="text-sm text-muted-foreground">
          {canManage ? "All projects" : "Your assigned projects"} &middot;{" "}
          {openItems.length} open
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <ListChecks size={24} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No action items</p>
          <p className="text-xs text-muted-foreground">
            Create them from inside a project.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {openItems.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-mono)" }}>
                Open — {openItems.length}
              </h2>
              <div className="space-y-2">
                {openItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 bg-card border border-border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Link
                          href={`/projects/${item.project.id}`}
                          className="text-xs text-primary hover:text-primary/70 transition-colors"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {item.project.name}
                        </Link>
                        {item.owner && (
                          <span
                            className="text-xs text-muted-foreground"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {getDisplayName(item.owner)}
                          </span>
                        )}
                        {item.deadline && (
                          <span
                            className={`text-xs ${
                              item.deadline < new Date()
                                ? "text-[#A4503C]"
                                : "text-muted-foreground"
                            }`}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            due {formatDateOnly(item.deadline)}
                          </span>
                        )}
                        {item.carriedOver && (
                          <span
                            className="text-xs text-[#C99846] bg-[#FBF3DB] px-1.5 py-0.5 rounded"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            carried over
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canAssign && (
                        <ActionItemModal
                          mode="edit"
                          projectId={item.project.id}
                          assignees={assigneesByProject[item.project.id] ?? []}
                          item={{
                            id: item.id,
                            description: item.description,
                            ownerId: item.ownerId,
                            deadline: item.deadline?.toISOString() ?? null,
                          }}
                          trigger={
                            <button
                              type="button"
                              title="Edit"
                              data-testid="action-item-edit"
                              className="text-muted-foreground clickable-icon"
                            >
                              <PencilSimple size={12} />
                            </button>
                          }
                        />
                      )}
                      {(canCloseAll || item.ownerId === user.id) && (
                        <form
                          action={async () => {
                            "use server";
                            await closeActionItem(item.id);
                          }}
                        >
                          <button
                            type="submit"
                            title="Mark done"
                            className="cursor-pointer flex-shrink-0 w-6 h-6 rounded border border-border hover:border-[#588157] hover:bg-[#EDF3EC] transition-colors flex items-center justify-center text-muted-foreground hover:text-[#588157]"
                          >
                            <Check size={12} />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {doneItems.length > 0 && (
            <section>
              <details>
                <summary
                  className="clickable text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Completed — {doneItems.length}
                </summary>
                <div className="mt-3 space-y-2">
                  {doneItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card border border-border rounded-lg opacity-60"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground line-through">{item.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Link
                            href={`/projects/${item.project.id}`}
                            className="text-xs text-muted-foreground clickable-icon"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {item.project.name}
                          </Link>
                          {item.completedAt && (
                            <span
                              className="text-xs text-muted-foreground"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              done{" "}
                              {item.completedAt.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      {canCloseAll && (
                        <form
                          action={async () => {
                            "use server";
                            await reopenActionItem(item.id);
                          }}
                        >
                          <button
                            type="submit"
                            title="Re-open"
                            className="text-muted-foreground clickable-icon"
                          >
                            <ArrowClockwise size={12} />
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
