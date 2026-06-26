import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { TimelineStatusBadge } from "@/components/status-badge";
import { DeliverableProgress } from "@/components/charts/deliverable-progress";
import { GoalCompletionChart } from "@/components/charts/goal-completion-chart";
import { StatusHistoryStrip } from "@/components/charts/status-history-strip";
import {
  ArrowLeft,
  Download,
  CheckCircle,
  Circle,
  Warning,
  MinusCircle,
} from "@phosphor-icons/react/dist/ssr";

function formatWeek(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canViewAll =
    permissions.includes(Permission.VIEW_ALL_PROJECTS) ||
    permissions.includes(Permission.MANAGE_PROJECTS);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      deliverables: {
        orderBy: { orderIndex: "asc" },
        include: {
          subtasks: {
            orderBy: { orderIndex: "asc" },
            include: {
              assignee: { select: { name: true, email: true } },
            },
          },
        },
      },
      meetingRecords: {
        orderBy: { meetingDate: "asc" },
        select: { meetingDate: true, status: true, goalMet: true },
      },
    },
  });

  if (!project) notFound();

  const membership = await getProjectMembership(user.id, id);
  if (!membership && !canViewAll) notFound();

  const now = new Date();

  // Deliverable progress for the chart
  const deliverableStats = project.deliverables.map((d) => ({
    id: d.id,
    title: d.title,
    completed: d.completed,
    subtasksTotal: d.subtasks.length,
    subtasksDone: d.subtasks.filter((s) => s.status === "COMPLETE").length,
  }));

  // Determine overall date range for the timeline
  const allDates = [
    ...project.deliverables.map((d) => d.targetDate),
    ...project.deliverables.flatMap((d) => d.subtasks.map((s) => s.dueDate).filter(Boolean)),
  ] as Date[];
  const minDate =
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : now;
  const maxDate =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : now;

  // Timeline bar helpers
  const rangeMs = Math.max(maxDate.getTime() - minDate.getTime(), 1);
  function pct(date: Date) {
    return Math.min(
      100,
      Math.max(0, ((date.getTime() - minDate.getTime()) / rangeMs) * 100)
    );
  }
  const nowPct = pct(now);

  const subtaskStatusIcon = (status: string) => {
    if (status === "COMPLETE") return <CheckCircle size={13} className="text-[#588157]" weight="fill" />;
    if (status === "BLOCKED") return <Warning size={13} className="text-[#A4503C]" weight="fill" />;
    if (status === "IN_PROGRESS") return <MinusCircle size={13} className="text-[#1F6C9F]" weight="fill" />;
    return <Circle size={13} className="text-muted-foreground" />;
  };

  const goalData = project.meetingRecords.map((r) => ({
    week: formatWeek(r.meetingDate),
    goalMet: r.goalMet,
  }));

  const statusData = project.meetingRecords.map((r) => ({
    week: formatWeek(r.meetingDate),
    status: r.status,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <ArrowLeft size={12} />
            {project.name}
          </Link>
          <h1
            className="text-2xl text-foreground"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Timeline
          </h1>
          <p
            className="text-xs text-muted-foreground mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {project.semester} &middot; {project.deliverables.length} deliverable
            {project.deliverables.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href={`/api/projects/${id}/export`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
          download
        >
          <Download size={14} />
          Export Excel
        </a>
      </div>

      {/* Gantt-style timeline */}
      {project.deliverables.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <p className="text-sm text-muted-foreground">No deliverables yet.</p>
        </div>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">Deliverable Timeline</h2>

          {/* Date axis */}
          <div className="relative mb-2 h-6 ml-[220px]">
            <div
              className="absolute top-0 h-full border-l border-[#A4503C] z-10"
              style={{ left: `${nowPct}%` }}
            >
              <span
                className="absolute -top-0.5 left-1.5 text-[10px] text-[#A4503C]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                today
              </span>
            </div>
            <div className="absolute left-0 top-4 text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {formatWeek(minDate)}
            </div>
            <div className="absolute right-0 top-4 text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {formatWeek(maxDate)}
            </div>
          </div>

          <div className="space-y-px">
            {project.deliverables.map((d) => {
              const targetPct = pct(d.targetDate);
              const startPct = d.startDate ? pct(d.startDate) : 0;
              const isOverdue = !d.completed && d.targetDate < now;

              return (
                <div key={d.id}>
                  {/* Deliverable row */}
                  <div className="flex items-center gap-3 py-2 group">
                    <div className="w-[220px] flex-shrink-0 flex items-center gap-2">
                      <TimelineStatusBadge status={d.status} />
                      <span className="text-xs text-foreground truncate">{d.title}</span>
                    </div>
                    <div className="flex-1 relative h-5">
                      {/* Bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm"
                        style={{
                          left: `${startPct}%`,
                          right: `${100 - targetPct}%`,
                          backgroundColor: d.completed
                            ? "#588157"
                            : isOverdue
                              ? "#A4503C"
                              : "#2E4034",
                          opacity: d.completed ? 0.6 : 1,
                        }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-current"
                        style={{
                          left: `${targetPct}%`,
                          color: isOverdue ? "#A4503C" : "#2E4034",
                        }}
                      />
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 border-l border-[#A4503C]/40 z-10"
                        style={{ left: `${nowPct}%` }}
                      />
                    </div>
                    <div
                      className="w-24 flex-shrink-0 text-right text-[10px] text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatWeek(d.targetDate)}
                    </div>
                  </div>

                  {/* Subtask rows */}
                  {d.subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-1.5 pl-4 opacity-80">
                      <div className="w-[220px] flex-shrink-0 flex items-center gap-2">
                        <div className="ml-4">{subtaskStatusIcon(s.status)}</div>
                        <span className="text-xs text-muted-foreground truncate">{s.title}</span>
                      </div>
                      <div className="flex-1 relative h-4">
                        {s.dueDate && (
                          <>
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-sm"
                              style={{
                                left: s.startDate ? `${pct(s.startDate)}%` : `${pct(s.dueDate) - 5}%`,
                                right: `${100 - pct(s.dueDate)}%`,
                                minWidth: "4px",
                                backgroundColor:
                                  s.status === "COMPLETE"
                                    ? "#A3B18A"
                                    : s.status === "BLOCKED"
                                      ? "#B07156"
                                      : "#A3B18A",
                                opacity: 0.6,
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 border-l border-[#A4503C]/40 z-10"
                              style={{ left: `${nowPct}%` }}
                            />
                          </>
                        )}
                      </div>
                      <div
                        className="w-24 flex-shrink-0 text-right text-[10px] text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {s.dueDate
                          ? formatWeek(s.dueDate)
                          : s.assignee
                            ? (s.assignee.name ?? s.assignee.email.split("@")[0])
                            : ""}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Progress bars */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">Deliverable Progress</h2>
        <div className="p-4 bg-card border border-border rounded-xl">
          <DeliverableProgress deliverables={deliverableStats} />
        </div>
      </section>

      {/* Charts */}
      {project.meetingRecords.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <section className="p-4 bg-card border border-border rounded-xl">
            <h2 className="text-sm font-semibold text-foreground mb-3">Weekly Goals</h2>
            <GoalCompletionChart data={goalData} />
          </section>

          <section className="p-4 bg-card border border-border rounded-xl">
            <h2 className="text-sm font-semibold text-foreground mb-3">Status History</h2>
            <div className="pt-2">
              <StatusHistoryStrip data={statusData} />
            </div>
            <div className="flex items-center gap-4 mt-4">
              {(["ON_TRACK", "AT_RISK", "BEHIND"] as const).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor:
                        s === "ON_TRACK" ? "#588157" : s === "AT_RISK" ? "#C99846" : "#A4503C",
                    }}
                  />
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s === "ON_TRACK" ? "On Track" : s === "AT_RISK" ? "At Risk" : "Behind"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
