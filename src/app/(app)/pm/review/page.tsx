import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge } from "@/components/status-badge";
import { BlockerFrequencyChart } from "@/components/charts/blocker-frequency-chart";
import { GoalCompletionChart } from "@/components/charts/goal-completion-chart";
import { extractBlockerFrequency, findConsecutiveMisses } from "@/lib/analytics";
import Link from "next/link";
import {
  Warning,
  TrendDown,
  Wrench,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";

export default async function MonthlyReviewPage() {
  await requirePermission(Permission.VIEW_MONTHLY_REVIEW);

  const [settings, projects] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: { select: { role: true, user: { select: { name: true, email: true } } } },
        deliverables: {
          where: { completed: false },
          select: { targetDate: true },
        },
        meetingRecords: {
          orderBy: { meetingDate: "asc" },
          select: { meetingDate: true, goalMet: true, keyBlockers: true, status: true },
        },
        statusUpdates: {
          orderBy: { meetingDate: "asc" },
          select: { meetingDate: true, blockers: true, helpNeeded: true, needsHelp: true },
        },
        actionItems: {
          where: { status: "OPEN" },
          select: { id: true, carriedOver: true },
        },
      },
    }),
  ]);

  const missedThreshold = settings?.missedGoalsInARow ?? 2;
  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  // ── Analysis ─────────────────────────────────────────────────────────────

  // 1. Projects missing goals multiple weeks in a row
  const repeatedMissers = projects
    .map((p) => ({
      project: p,
      streak: findConsecutiveMisses(p.meetingRecords, missedThreshold),
    }))
    .filter(({ streak }) => streak >= missedThreshold)
    .sort((a, b) => b.streak - a.streak);

  // 2. Most common blockers across all projects
  const allBlockers = projects.flatMap((p) => [
    ...p.meetingRecords.map((r) => r.keyBlockers),
    ...p.statusUpdates.map((u) => u.blockers),
  ]);
  const blockerFrequency = extractBlockerFrequency(allBlockers, 10);

  // 3. Recurring resource/skill gaps (from helpNeeded field)
  const helpTexts = projects.flatMap((p) =>
    p.statusUpdates.filter((u) => u.needsHelp).map((u) => u.helpNeeded)
  );
  const gapFrequency = extractBlockerFrequency(helpTexts, 8);

  // 4. Projects needing priority shift: BEHIND + no corrective action plan
  const needsAttention = projects.filter(
    (p) => p.status === "BEHIND"
  );

  // Projects with overdue deliverables
  const overdueProjects = projects.filter((p) =>
    p.deliverables.some((d) => d.targetDate < now)
  );

  // Health grid data
  const healthGrid = projects.map((p) => {
    const lastRecord = p.meetingRecords[p.meetingRecords.length - 1];
    const goalData = p.meetingRecords.map((r) => ({
      week: r.meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      goalMet: r.goalMet,
    }));
    const openActionItems = p.actionItems.length;
    const carriedOver = p.actionItems.filter((a) => a.carriedOver).length;
    const streak = findConsecutiveMisses(p.meetingRecords, 1);

    return {
      project: p,
      lastRecord,
      goalData,
      openActionItems,
      carriedOver,
      streak,
    };
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          PM Tools
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Monthly Review
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length} projects &middot;{" "}
          {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Flags */}
      {needsAttention.length > 0 && (
        <section className="p-4 bg-[#FDEBEC] border border-[#A4503C]/20 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Warning size={15} className="text-[#A4503C]" weight="fill" />
            <h2 className="text-sm font-semibold text-[#A4503C]">
              {needsAttention.length} project{needsAttention.length !== 1 ? "s" : ""} Behind
            </h2>
          </div>
          <div className="space-y-2">
            {needsAttention.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-sm font-medium text-[#A4503C] hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p
                    className="text-xs text-[#A4503C]/70"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {p.correctiveActionPlan ? "has corrective plan" : "no corrective plan"}
                  </p>
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  className="text-xs text-[#A4503C] hover:text-[#A4503C]/70 transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  View <ArrowRight size={10} className="inline" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All-projects health grid */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">Project Health Overview</h2>
        <div className="grid grid-cols-2 gap-3">
          {healthGrid.map(({ project: p, goalData, openActionItems, carriedOver, streak }) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/timeline`}
              className="p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {p.name}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {p.semester}
                  </p>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>

              {/* Mini goal chart */}
              {goalData.length > 0 ? (
                <GoalCompletionChart data={goalData} />
              ) : (
                <div className="h-[80px] flex items-center justify-center">
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    No meetings recorded
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {openActionItems} open action item{openActionItems !== 1 ? "s" : ""}
                  {carriedOver > 0 && (
                    <span className="text-[#C99846]"> ({carriedOver} carried)</span>
                  )}
                </span>
                {streak >= 2 && (
                  <span
                    className="text-xs text-[#A4503C] bg-[#FDEBEC] px-1.5 py-0.5 rounded ml-auto"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {streak}× missed
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Repeated goal missers */}
      {repeatedMissers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendDown size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Repeated Goal Misses (&ge;{missedThreshold} in a row)
            </h2>
          </div>
          <div className="space-y-2">
            {repeatedMissers.map(({ project: p, streak }) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg"
              >
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {p.name}
                  </Link>
                  <p
                    className="text-xs text-muted-foreground mt-0.5"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {streak} consecutive missed goal{streak !== 1 ? "s" : ""}
                  </p>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Overdue deliverables */}
      {overdueProjects.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Warning size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Overdue Deliverables</h2>
          </div>
          <div className="space-y-2">
            {overdueProjects.map((p) => {
              const overdue = p.deliverables.filter((d) => d.targetDate < now);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg"
                >
                  <div>
                    <Link
                      href={`/projects/${p.id}/timeline`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {p.name}
                    </Link>
                    <p
                      className="text-xs text-muted-foreground mt-0.5"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {overdue.length} deliverable{overdue.length !== 1 ? "s" : ""} past target
                    </p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Blocker frequency */}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Warning size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Common Blockers</h2>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            <BlockerFrequencyChart data={blockerFrequency} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Resource / Skill Gaps</h2>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            {gapFrequency.length > 0 ? (
              <BlockerFrequencyChart data={gapFrequency} />
            ) : (
              <div className="h-32 flex items-center justify-center">
                <p
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  No help requests recorded
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
