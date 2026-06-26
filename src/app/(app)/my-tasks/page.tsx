import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TimelineStatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { CheckSquare } from "@phosphor-icons/react/dist/ssr";

export default async function MyTasksPage() {
  const user = await requireAuth();

  const subtasks = await prisma.subtask.findMany({
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
  });

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
          Open Subtasks
        </h1>
      </div>

      {subtasks.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <CheckSquare size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
        </div>
      ) : (
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
                    {subtask.dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
                <TimelineStatusBadge status={subtask.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
