import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge, TimelineStatusBadge } from "@/components/status-badge";
import {
  ArrowLeft,
  Plus,
  ClipboardText,
  CalendarCheck,
  Users,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { deleteDeliverable } from "@/lib/actions/deliverables";
import { removeMember } from "@/lib/actions/projects";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManage = permissions.includes(Permission.MANAGE_PROJECTS);
  const canManageMilestones = permissions.includes(Permission.MANAGE_MILESTONES);
  const canPostMeeting = permissions.includes(Permission.POST_MEETING_TRACKING);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      deliverables: {
        orderBy: { orderIndex: "asc" },
        include: {
          subtasks: {
            orderBy: { orderIndex: "asc" },
            include: {
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      statusUpdates: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: {
          submittedBy: { select: { name: true, email: true } },
        },
      },
      meetingRecords: {
        orderBy: { meetingDate: "desc" },
        take: 5,
        include: {
          recordedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const membership = await getProjectMembership(user.id, id);
  const canViewAll = permissions.includes(Permission.VIEW_ALL_PROJECTS) || canManage;

  // Must be assigned or have global view permission
  if (!membership && !canViewAll) notFound();

  const canSubmitStatus =
    membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  const canEditProject =
    canManage || membership?.role === "LEAD" || membership?.role === "SUBLEAD";

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          Projects
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-3xl text-foreground"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
              {project.statusOverride && (
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  (manual)
                </span>
              )}
            </div>
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {project.semester}
            </p>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2">{project.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canSubmitStatus && (
              <Link
                href={`/projects/${id}/status/new`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
              >
                <ClipboardText size={14} />
                Submit Update
              </Link>
            )}
            {canPostMeeting && (
              <Link
                href={`/projects/${id}/meeting/new`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:bg-primary/80 transition-colors"
              >
                <CalendarCheck size={14} />
                Record Meeting
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Corrective Action Plan (if BEHIND) */}
      {project.status === "BEHIND" && (
        <div className="p-4 bg-[#FDEBEC] border border-[#A4503C]/20 rounded-xl flex items-start gap-3">
          <Warning size={16} className="text-[#A4503C] mt-0.5 flex-shrink-0" weight="fill" />
          <div>
            <p className="text-sm font-medium text-[#A4503C]">Project is Behind</p>
            {project.correctiveActionPlan ? (
              <p className="text-xs text-[#A4503C]/80 mt-0.5">{project.correctiveActionPlan}</p>
            ) : (
              <p className="text-xs text-[#A4503C]/80 mt-0.5">
                Corrective action plan required.{" "}
                {canEditProject && (
                  <Link href={`/projects/${id}/edit`} className="underline">
                    Add one
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Timeline: Deliverables */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Deliverables</h2>
          {canManageMilestones && (
            <Link
              href={`/projects/${id}/deliverables/new`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <Plus size={12} />
              Add deliverable
            </Link>
          )}
        </div>

        {project.deliverables.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center">
            <p className="text-sm text-muted-foreground">No deliverables yet.</p>
            {canManageMilestones && (
              <Link
                href={`/projects/${id}/deliverables/new`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                <Plus size={14} />
                Add first deliverable
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {project.deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
                className="border border-border rounded-xl overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4 p-4 bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {deliverable.title}
                      </span>
                      <TimelineStatusBadge status={deliverable.status} />
                      {deliverable.completed && (
                        <span
                          className="text-xs text-[#588157]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          Done
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Target:{" "}
                      {deliverable.targetDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {deliverable.startDate && (
                        <>
                          {" "}
                          &middot; Start:{" "}
                          {deliverable.startDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {canManageMilestones && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/projects/${id}/deliverables/${deliverable.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Edit
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await deleteDeliverable(deliverable.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Subtasks */}
                {deliverable.subtasks.length > 0 && (
                  <div className="border-t border-border divide-y divide-border">
                    {deliverable.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center justify-between px-4 py-2.5 bg-background/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            subtask.status === "COMPLETE" ? "bg-[#588157]" :
                            subtask.status === "BLOCKED" ? "bg-[#A4503C]" :
                            subtask.status === "IN_PROGRESS" ? "bg-[#1F6C9F]" :
                            "bg-[#787774]"
                          }`} />
                          <span className="text-xs text-foreground">{subtask.title}</span>
                          {subtask.assignee && (
                            <span
                              className="text-xs text-muted-foreground"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {subtask.assignee.name ?? subtask.assignee.email.split("@")[0]}
                            </span>
                          )}
                        </div>
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
                      </div>
                    ))}
                  </div>
                )}

                {canManageMilestones && (
                  <div className="border-t border-border px-4 py-2">
                    <Link
                      href={`/projects/${id}/deliverables/${deliverable.id}/subtasks/new`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <Plus size={10} />
                      Add subtask
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Team</h2>
          {canManage && (
            <Link
              href={`/projects/${id}/members`}
              className="text-xs font-medium text-primary hover:text-primary/70 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Manage members
            </Link>
          )}
        </div>
        {project.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members assigned.</p>
        ) : (
          <div className="grid gap-2">
            {project.assignments.map((a) => (
              <div
                key={a.userId}
                className="flex items-center justify-between px-4 py-2.5 bg-card border border-border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {a.user.name ?? a.user.email.split("@")[0]}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.role.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Status Updates */}
      {project.statusUpdates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Status Updates</h2>
          <div className="space-y-3">
            {project.statusUpdates.map((update) => (
              <div
                key={update.id}
                className="p-4 bg-card border border-border rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {update.meetingDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    &middot; {update.submittedBy.name ?? update.submittedBy.email.split("@")[0]}
                  </span>
                  {update.isLate && (
                    <span
                      className="text-xs text-[#A4503C] bg-[#FDEBEC] px-1.5 py-0.5 rounded"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Late
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Planned</p>
                    <p className="text-xs text-foreground line-clamp-2">{update.plannedWork}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Actual</p>
                    <p className="text-xs text-foreground line-clamp-2">{update.actualProgress}</p>
                  </div>
                  {update.blockers && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Blockers</p>
                      <p className="text-xs text-foreground line-clamp-2">{update.blockers}</p>
                    </div>
                  )}
                  {update.needsHelp && update.helpNeeded && (
                    <div>
                      <p className="text-xs font-medium text-[#C99846] mb-1">Help Needed</p>
                      <p className="text-xs text-foreground line-clamp-2">{update.helpNeeded}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Meeting Records */}
      {project.meetingRecords.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">Meeting Records</h2>
          <div className="space-y-3">
            {project.meetingRecords.map((record) => (
              <div key={record.id} className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {record.meetingDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {record.goalMet !== null && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          record.goalMet
                            ? "bg-[#EDF3EC] text-[#588157]"
                            : "bg-[#FDEBEC] text-[#A4503C]"
                        }`}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Goal {record.goalMet ? "Met" : "Missed"}
                      </span>
                    )}
                    <ProjectStatusBadge status={record.status} />
                  </div>
                </div>
                {record.keyBlockers && (
                  <p className="text-xs text-foreground">
                    <span className="text-muted-foreground font-medium">Blockers: </span>
                    {record.keyBlockers}
                  </p>
                )}
                {record.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
