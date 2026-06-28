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
import { getDisplayName } from "@/lib/utils";

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
              assignee: { select: { name: true, firstName: true, nickname: true, email: true } },
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

  // Collect all meaningful dates for range calculation (include startDates)
  const allDates: Date[] = [
    ...project.deliverables.map((d) => d.targetDate),
    ...project.deliverables.flatMap((d) => [d.startDate].filter(Boolean) as Date[]),
    ...project.deliverables.flatMap((d) =>
      d.subtasks.flatMap((s) => [s.dueDate, s.startDate].filter(Boolean) as Date[])
    ),
  ];

  let minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map((d) => d.getTime())))
    : now;
  let maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : now;

  // Pad degenerate ranges so bars aren't bunched at one edge
  const MS_PER_DAY = 86_400_000;
  if (maxDate.getTime() - minDate.getTime() < 7 * MS_PER_DAY) {
    minDate = new Date(minDate.getTime() - 7 * MS_PER_DAY);
    maxDate = new Date(maxDate.getTime() + 7 * MS_PER_DAY);
  }

  const rangeMs = maxDate.getTime() - minDate.getTime();
  function pct(date: Date) {
    return Math.min(100, Math.max(0, ((date.getTime() - minDate.getTime()) / rangeMs) * 100));
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

          {/*
            Unified grid: label(220px) | track(1fr) | date(96px)
            The today line and all bars are positioned within the track column only,
            so they always share the same horizontal extent.
          */}
          <div className="space-y-px">
            {/* Axis row */}
            <div className="grid items-center mb-1" style={{ gridTemplateColumns: "220px 1fr 96px" }}>
              <div />
              <div className="relative h-6">
                {/* Today line */}
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
                <span
                  className="absolute bottom-0 left-0 text-[10px] text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {formatWeek(minDate)}
                </span>
                <span
                  className="absolute bottom-0 right-0 text-[10px] text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {formatWeek(maxDate)}
                </span>
              </div>
              <div />
            </div>

            {project.deliverables.map((d) => {
              const targetPct = pct(d.targetDate);
              const isOverdue = !d.completed && d.targetDate < now;
              const hasBar = !!d.startDate && d.startDate < d.targetDate;
              const startPct = d.startDate ? pct(d.startDate) : null;
              const barColor = d.completed ? "#588157" : isOverdue ? "#A4503C" : "#2E4034";

              return (
                <div key={d.id}>
                  {/* Deliverable row */}
                  <div className="grid items-center py-2" style={{ gridTemplateColumns: "220px 1fr 96px" }}>
                    <div className="flex items-center gap-2 pr-3">
                      <TimelineStatusBadge status={d.status} />
                      <span className="text-xs text-foreground truncate">{d.title}</span>
                    </div>
                    <div className="relative h-5">
                      {hasBar ? (
                        /* Bar from startDate to targetDate */
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm"
                          style={{
                            left: `${startPct}%`,
                            right: `${100 - targetPct}%`,
                            backgroundColor: barColor,
                            opacity: d.completed ? 0.6 : 1,
                          }}
                        />
                      ) : (
                        /* Milestone diamond at targetDate — no startDate or start >= target */
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45"
                          style={{
                            left: `calc(${targetPct}% - 6px)`,
                            backgroundColor: barColor,
                            opacity: d.completed ? 0.6 : 1,
                          }}
                        />
                      )}
                      {/* Target marker line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5"
                        style={{ left: `${targetPct}%`, backgroundColor: isOverdue ? "#A4503C" : "#2E4034" }}
                      />
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 border-l border-[#A4503C]/40 z-10"
                        style={{ left: `${nowPct}%` }}
                      />
                    </div>
                    <div
                      className="text-right text-[10px] text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatWeek(d.targetDate)}
                    </div>
                  </div>

                  {/* Subtask rows */}
                  {d.subtasks.map((s) => {
                    const duePct = s.dueDate ? pct(s.dueDate) : null;
                    const sStartPct = s.startDate ? pct(s.startDate) : null;
                    const hasSubBar = sStartPct !== null && duePct !== null && s.startDate! < s.dueDate!;
                    const subBarColor = s.status === "BLOCKED" ? "#B07156" : "#A3B18A";

                    return (
                      <div key={s.id} className="grid items-center py-1.5 pl-4 opacity-80" style={{ gridTemplateColumns: "220px 1fr 96px" }}>
                        <div className="flex items-center gap-2 pr-3">
                          <div className="ml-4">{subtaskStatusIcon(s.status)}</div>
                          <span className="text-xs text-muted-foreground truncate">{s.title}</span>
                        </div>
                        <div className="relative h-4">
                          {duePct !== null && (
                            <>
                              {hasSubBar ? (
                                /* Bar */
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 h-2 rounded-sm"
                                  style={{
                                    left: `${sStartPct}%`,
                                    right: `${100 - duePct}%`,
                                    backgroundColor: subBarColor,
                                    opacity: 0.6,
                                  }}
                                />
                              ) : (
                                /* Dot marker at dueDate */
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                                  style={{
                                    left: `calc(${duePct}% - 4px)`,
                                    backgroundColor: subBarColor,
                                    opacity: 0.7,
                                  }}
                                />
                              )}
                              {/* Today line */}
                              <div
                                className="absolute top-0 bottom-0 border-l border-[#A4503C]/40 z-10"
                                style={{ left: `${nowPct}%` }}
                              />
                            </>
                          )}
                        </div>
                        <div
                          className="text-right text-[10px] text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {s.dueDate
                            ? formatWeek(s.dueDate)
                            : s.assignee
                              ? getDisplayName(s.assignee)
                              : ""}
                        </div>
                      </div>
                    );
                  })}
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
