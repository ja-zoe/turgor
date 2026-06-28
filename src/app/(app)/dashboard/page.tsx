import Link from "next/link";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { getStatusSubmissionState } from "@/lib/lead-meeting";
import { getDisplayName } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/status-badge";
import { DeliverableProgress } from "@/components/charts/deliverable-progress";
import { GoalCompletionChart } from "@/components/charts/goal-completion-chart";
import {
  ArrowRight,
  ClipboardText,
  Folders,
  Plant,
  Warning,
  ChartBar,
  ListChecks,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";

export default async function DashboardPage() {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManageProjects = permissions.includes(Permission.MANAGE_PROJECTS);
  const canMonthlyReview = permissions.includes(Permission.VIEW_MONTHLY_REVIEW);

  const assignments = await prisma.projectAssignment.findMany({
    where: { userId: user.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          semester: true,
          status: true,
          _count: { select: { deliverables: true } },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  // All projects if PM
  const allProjects = canManageProjects
    ? await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          semester: true,
          status: true,
          correctiveActionPlan: true,
          _count: { select: { deliverables: true, actionItems: { where: { status: "OPEN" } } } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      })
    : null;

  const myProjects = assignments.map((a) => a.project);

  // A lead/sublead may submit; the CTA also needs the project's submission state.
  const roleByProject = new Map(assignments.map((a) => [a.project.id, a.role]));

  // Most recent status update + chart data per my project
  type ProjectChartData = {
    lastSubmitted: Date | null;
    canSubmit: boolean; // active lead meeting in window + not yet submitted + user is a lead
    goalData: { week: string; goalMet: boolean | null }[];
    deliverableStats: {
      id: string;
      title: string;
      completed: boolean;
      subtasksTotal: number;
      subtasksDone: number;
    }[];
  };
  const projectData: Record<string, ProjectChartData> = {};
  for (const p of myProjects) {
    const [latest, submissionState, meetingRecords, deliverables] = await Promise.all([
      prisma.statusUpdate.findFirst({
        where: { projectId: p.id, submittedById: user.id },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),
      getStatusSubmissionState(p.id),
      prisma.meetingRecord.findMany({
        where: { projectId: p.id },
        orderBy: { meetingDate: "asc" },
        take: 12,
        select: { meetingDate: true, goalMet: true },
      }),
      prisma.deliverable.findMany({
        where: { projectId: p.id },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          completed: true,
          subtasks: { where: {}, select: { status: true } },
        },
      }),
    ]);
    const role = roleByProject.get(p.id);
    projectData[p.id] = {
      lastSubmitted: latest?.submittedAt ?? null,
      canSubmit: submissionState.canSubmit && (role === "LEAD" || role === "SUBLEAD"),
      goalData: meetingRecords.map((r) => ({
        week: r.meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        goalMet: r.goalMet,
      })),
      deliverableStats: deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        completed: d.completed,
        subtasksTotal: d.subtasks.length,
        subtasksDone: d.subtasks.filter((s) => s.status === "COMPLETE").length,
      })),
    };
  }

  // PM stats
  let pmStats: { total: number; behind: number; atRisk: number; openItems: number } | null = null;
  if (canManageProjects && allProjects) {
    const openItems = await prisma.actionItem.count({ where: { status: "OPEN" } });
    pmStats = {
      total: allProjects.length,
      behind: allProjects.filter((p) => p.status === "BEHIND").length,
      atRisk: allProjects.filter((p) => p.status === "AT_RISK").length,
      openItems,
    };
  }

  // My open action items
  const myActionItems = await prisma.actionItem.findMany({
    where: { ownerId: user.id, status: "OPEN" },
    orderBy: [{ carriedOver: "desc" }, { deadline: "asc" }],
    take: 5,
    include: { project: { select: { id: true, name: true } } },
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, nickname: true, name: true },
  });
  const displayName = getDisplayName({
    firstName: dbUser?.firstName ?? null,
    nickname: dbUser?.nickname ?? null,
    name: dbUser?.name ?? user.name ?? null,
    email: user.email,
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Dashboard
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Good to see you, {displayName}.
        </h1>
      </div>

      {/* PM stats grid */}
      {pmStats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-4 bg-card border border-border rounded-xl">
            <p
              className="text-xs text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Projects
            </p>
            <p
              className="text-3xl text-foreground"
              style={{ fontFamily: "var(--font-display)", lineHeight: 1 }}
            >
              {pmStats.total}
            </p>
          </div>
          <div
            className={`p-4 rounded-xl border ${pmStats.behind > 0 ? "bg-[#FDEBEC] border-[#A4503C]/20" : "bg-card border-border"}`}
          >
            <p
              className={`text-xs uppercase tracking-widest mb-2 ${pmStats.behind > 0 ? "text-[#A4503C]" : "text-muted-foreground"}`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Behind
            </p>
            <p
              className={`text-3xl ${pmStats.behind > 0 ? "text-[#A4503C]" : "text-foreground"}`}
              style={{ fontFamily: "var(--font-display)", lineHeight: 1 }}
            >
              {pmStats.behind}
            </p>
          </div>
          <div
            className={`p-4 rounded-xl border ${pmStats.atRisk > 0 ? "bg-[#FBF3DB]/60 border-[#C99846]/20" : "bg-card border-border"}`}
          >
            <p
              className={`text-xs uppercase tracking-widest mb-2 ${pmStats.atRisk > 0 ? "text-[#C99846]" : "text-muted-foreground"}`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              At Risk
            </p>
            <p
              className={`text-3xl ${pmStats.atRisk > 0 ? "text-[#C99846]" : "text-foreground"}`}
              style={{ fontFamily: "var(--font-display)", lineHeight: 1 }}
            >
              {pmStats.atRisk}
            </p>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            <p
              className="text-xs text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Open Actions
            </p>
            <p
              className="text-3xl text-foreground"
              style={{ fontFamily: "var(--font-display)", lineHeight: 1 }}
            >
              {pmStats.openItems}
            </p>
          </div>
        </div>
      )}

      {/* PM shortcuts */}
      {canManageProjects && (
        <div className="flex items-center gap-3">
          {canMonthlyReview && (
            <Link
              href="/pm/review"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 hover:bg-primary/80 transition-colors"
            >
              <ChartBar size={14} />
              Monthly Review
            </Link>
          )}
          <Link
            href="/action-items"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card text-sm font-medium px-4 py-2.5 hover:bg-muted transition-colors"
          >
            <ListChecks size={14} />
            All Action Items
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card text-sm font-medium px-4 py-2.5 hover:bg-muted transition-colors"
          >
            <Folders size={14} />
            New Project
          </Link>
        </div>
      )}

      {/* My open action items */}
      {myActionItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks size={14} className="text-muted-foreground" />
              My Action Items
            </h2>
            <Link
              href="/action-items"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {myActionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.description}</p>
                  <Link
                    href={`/projects/${item.project.id}`}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {item.project.name}
                  </Link>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.carriedOver && (
                    <span
                      className="text-xs text-[#C99846] bg-[#FBF3DB] px-1.5 py-0.5 rounded"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      carried
                    </span>
                  )}
                  {item.deadline && (
                    <span
                      className={`text-xs ${item.deadline < new Date() ? "text-[#A4503C]" : "text-muted-foreground"}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {item.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Projects with charts */}
      {myProjects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">My Projects</h2>
          <div className="space-y-4">
            {myProjects.map((project) => {
              const data = projectData[project.id];
              return (
                <div
                  key={project.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  {/* Project header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Plant size={15} className="text-primary" weight="fill" />
                      <div>
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {project.name}
                        </Link>
                        <p
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {project.semester}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProjectStatusBadge status={project.status} />
                      <Link
                        href={`/projects/${project.id}/timeline`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        <CalendarBlank size={13} className="inline mr-1" />
                        Timeline
                      </Link>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>

                  {/* Charts + progress */}
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-4">
                      <p
                        className="text-xs text-muted-foreground mb-2"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Weekly Goals
                      </p>
                      <GoalCompletionChart data={data.goalData} />
                    </div>
                    <div className="p-4">
                      <p
                        className="text-xs text-muted-foreground mb-2"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Deliverable Progress
                      </p>
                      <DeliverableProgress deliverables={data.deliverableStats} />
                    </div>
                  </div>

                  {/* Submit update CTA — only when a lead meeting is open and nothing
                      has been submitted for it yet (hidden once submitted or out of window). */}
                  {data.canSubmit && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-[#FBF3DB]/40">
                      <div className="flex items-center gap-2 text-xs">
                        <ClipboardText size={12} className="text-[#C99846]" weight="fill" />
                        <span className="text-[#C99846]" style={{ fontFamily: "var(--font-mono)" }}>
                          Project standing due
                        </span>
                      </div>
                      <Link
                        href={`/projects/${project.id}/status/new`}
                        className="text-xs font-medium text-[#C99846] hover:text-[#A4503C] transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Submit Project Standing →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PM: All Projects table */}
      {canManageProjects && allProjects && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">All Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              View all →
            </Link>
          </div>
          {allProjects.length === 0 ? (
            <div className="p-8 border border-dashed border-border rounded-xl text-center">
              <Folders size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No projects yet.</p>
              <Link
                href="/projects/new"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                Create the first project
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              {allProjects.map((project, i) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i !== allProjects.length - 1 ? "border-b border-border" : ""
                  } hover:bg-muted/30 transition-colors`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {project.status === "BEHIND" && (
                      <Warning size={13} className="text-[#A4503C] flex-shrink-0" weight="fill" />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {project.name}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {project.semester} &middot; {project._count.deliverables} deliverable
                        {project._count.deliverables !== 1 ? "s" : ""}
                        {project._count.actionItems > 0 && (
                          <span className="text-[#C99846]">
                            {" "}&middot; {project._count.actionItems} open action item{project._count.actionItems !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ProjectStatusBadge status={project.status} />
                    <Link
                      href={`/projects/${project.id}/timeline`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Timeline
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No projects */}
      {myProjects.length === 0 && !canManageProjects && (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <Plant size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground">
            You haven&apos;t been assigned to any projects yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ask your Project Manager to add you to a project.
          </p>
        </div>
      )}
    </div>
  );
}
