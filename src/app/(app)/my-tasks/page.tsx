import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TimelineStatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { CheckSquare, ListChecks, Check } from "@phosphor-icons/react/dist/ssr";
import { closeActionItem } from "@/lib/actions/action-items";
import { formatDateOnly } from "@/lib/utils";

export default async function MyTasksPage() {
  const user = await requireAuth();

  const [subtasks, actionItems] = await Promise.all([
    prisma.subtask.findMany({
      where: {
        assigneeId: user.id,
        status: { not: "COMPLETE" },
      },
      include: {
        deliverable: {
          select: {
            title: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.actionItem.findMany({
      where: {
        ownerId: user.id,
        status: "OPEN",
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ carriedOver: "desc" }, { deadline: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const noWork = subtasks.length === 0 && actionItems.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          My Tasks
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Open Work
        </h1>
      </div>

      {noWork ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <CheckSquare size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {actionItems.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
                <ListChecks size={13} />
                Action Items — {actionItems.length}
              </h2>
              <div className="space-y-2">
                {actionItems.map((item) => (
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
                    <form
                      action={async () => {
                        "use server";
                        await closeActionItem(item.id);
                      }}
                    >
                      <button
                        type="submit"
                        title="Mark done"
                        className="flex-shrink-0 w-6 h-6 rounded border border-border hover:border-[#588157] hover:bg-[#EDF3EC] transition-colors flex items-center justify-center text-muted-foreground hover:text-[#588157]"
                      >
                        <Check size={12} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          )}

          {subtasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
                <CheckSquare size={13} />
                Subtasks — {subtasks.length}
              </h2>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <Link
                    key={subtask.id}
                    href={`/projects/${subtask.deliverable.project.id}`}
                    className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {subtask.title}
                      </p>
                      <p
                        className="text-xs text-muted-foreground mt-0.5"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {subtask.deliverable.project.name} &middot; {subtask.deliverable.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {subtask.dueDate && (
                        <span
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {formatDateOnly(subtask.dueDate)}
                        </span>
                      )}
                      <TimelineStatusBadge status={subtask.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
