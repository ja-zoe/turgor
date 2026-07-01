import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge } from "@/components/status-badge";
import { SortableDeliverables } from "@/components/sortable-deliverables";
import { ProjectModal } from "@/components/project-modal";
import { StatusUpdateControls } from "@/components/status-update-controls";
import { MeetingRecordControls } from "@/components/meeting-record-controls";
import { getStatusSubmissionState } from "@/lib/lead-meeting";
import {
  ArrowLeft,
  ClipboardText,
  CalendarCheck,
  Users,
  Warning,
  ListChecks,
  PencilSimple,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";
import { ActionItemsSection } from "@/components/action-items-section";
import { deleteDeliverable } from "@/lib/actions/deliverables";
import { removeMember } from "@/lib/actions/projects";
import { getDisplayName, projectDuration, formatProjectDate, formatDateOnly } from "@/lib/utils";

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
  const canAssignActionItems = permissions.includes(Permission.ASSIGN_ACTION_ITEMS);
  const canCloseActionItems = permissions.includes(Permission.CLOSE_ACTION_ITEMS);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, nickname: true, name: true, email: true } },
        },
      },
      deliverables: {
        orderBy: { orderIndex: "asc" },
        include: {
          subtasks: {
            orderBy: { orderIndex: "asc" },
            include: {
              assignee: { select: { id: true, firstName: true, nickname: true, name: true, email: true } },
            },
          },
        },
      },
      statusUpdates: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: {
          submittedBy: { select: { firstName: true, nickname: true, name: true, email: true } },
          calendarEvent: { select: { startsAt: true } },
        },
      },
      meetingRecords: {
        orderBy: { meetingDate: "desc" },
        take: 5,
        include: {
          recordedBy: { select: { firstName: true, nickname: true, name: true, email: true } },
        },
      },
      actionItems: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          owner: { select: { id: true, firstName: true, nickname: true, name: true, email: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const membership = await getProjectMembership(user.id, id);
  const canViewAll = permissions.includes(Permission.VIEW_ALL_PROJECTS) || canManage;
  if (!membership && !canViewAll) notFound();

  const submissionState = await getStatusSubmissionState(id);
  const allSemesters = (
    await prisma.project.findMany({
      select: { semester: true },
      distinct: ["semester"],
      orderBy: { semester: "desc" },
    })
  )
    .map((p) => p.semester)
    .filter(Boolean);
  const canManageStatusUpdates = permissions.includes(Permission.MANAGE_STATUS_UPDATES);
  const canManageMeetingRecords = permissions.includes(Permission.MANAGE_MEETING_RECORDS);
  const isLeadHere = membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  // A lead/sublead who holds EDIT_OWN_PROJECT may edit their own project (name, dates,
  // corrective action plan) — same fields as a PM, scoped to projects they lead.
  const canEditThisProject =
    canManage || (permissions.includes(Permission.EDIT_OWN_PROJECT) && isLeadHere);
  // "Submit Project Standing" only appears for a lead when the project's lead meeting is open
  // for submission AND nothing has been submitted for it yet.
  const canSubmitStatus = isLeadHere && submissionState.canSubmit;

  // Per-update edit/delete gate: privileged any time, or own update before its meeting.
  const canModifyStatusUpdate = (u: { submittedById: string; meetingDate: Date; calendarEvent: { startsAt: Date } | null }) =>
    canManageStatusUpdates ||
    (u.submittedById === user.id && isLeadHere &&
      new Date() <= new Date(u.calendarEvent?.startsAt ?? u.meetingDate));
  const canCreateActionItem =
    canAssignActionItems || membership?.role === "LEAD" || membership?.role === "SUBLEAD";

  const openItems = project.actionItems.filter((a) => a.status === "OPEN");
  const doneItems = project.actionItems.filter((a) => a.status === "DONE");

  const editableProject = {
    id,
    name: project.name,
    semester: project.semester,
    description: project.description,
    correctiveActionPlan: project.correctiveActionPlan,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
  };

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground clickable mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          Projects
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
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
            {(project.startDate || project.createdAt) && (
              <p
                className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <CalendarBlank size={11} />
                {formatProjectDate(project.startDate ?? project.createdAt)}
                {" – "}
                {project.endDate ? formatProjectDate(project.endDate) : "Present"}
                {" · "}
                {projectDuration(project.startDate ?? project.createdAt, project.endDate)}
              </p>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canEditThisProject && (
              <ProjectModal
                allSemesters={allSemesters}
                project={editableProject}
                canDelete={canManage}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md cursor-pointer border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
                    data-testid="edit-project"
                  >
                    <PencilSimple size={14} />
                    Edit project
                  </button>
                }
              />
            )}
            {canSubmitStatus && (
              <Link
                href={`/projects/${id}/status/new`}
                className="inline-flex items-center gap-1.5 rounded-md cursor-pointer border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
                data-testid="submit-standing-link"
              >
                <ClipboardText size={14} />
                {submissionState.count > 1
                  ? `You have ${submissionState.count} Project Standing Updates to submit`
                  : "Submit Project Standing"}
              </Link>
            )}
            {canPostMeeting && (
              <Link
                href={`/projects/${id}/meeting/new`}
                className="inline-flex items-center gap-1.5 rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:bg-primary/80 transition-colors"
              >
                <CalendarCheck size={14} />
                Record Meeting
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Behind warning */}
      {project.status === "BEHIND" && (
        <div className="p-4 bg-[#FDEBEC] border border-[#A4503C]/20 rounded-xl flex items-start gap-3">
          <Warning size={16} className="text-[#A4503C] mt-0.5 flex-shrink-0" weight="fill" />
          <div>
            <p className="text-sm font-medium text-[#A4503C]">Project is Behind</p>
            {project.correctiveActionPlan ? (
              <p className="text-xs text-[#A4503C]/80 mt-0.5">{project.correctiveActionPlan}</p>
            ) : (
              <p className="text-xs text-[#A4503C]/80 mt-0.5">
                A corrective action plan is required.{" "}
                {canEditThisProject && (
                  <ProjectModal
                    allSemesters={allSemesters}
                    project={editableProject}
                    canDelete={canManage}
                    trigger={
                      <button type="button" className="underline clickable-danger">
                        Add one
                      </button>
                    }
                  />
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Deliverables */}
      <section>
        <SortableDeliverables
          projectId={id}
          canManage={canManageMilestones || isLeadHere}
          canEdit={canManageMilestones || !!membership}
          userId={user.id}
          members={project.assignments.map((a) => a.user)}
          deliverables={project.deliverables.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description ?? null,
            status: d.status as "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE",
            priority: d.priority as "LOW" | "MEDIUM" | "HIGH",
            group: d.group,
            orderIndex: d.orderIndex,
            targetDate: d.targetDate.toISOString(),
            startDate: d.startDate?.toISOString() ?? null,
            completed: d.completed,
            subtasks: d.subtasks.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description ?? null,
              status: s.status as "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE",
              assignee: s.assignee,
              dueDate: s.dueDate?.toISOString() ?? null,
            })),
          }))}
          deleteDeliverableAction={async (deliverableId: string) => {
            "use server";
            await deleteDeliverable(deliverableId);
          }}
        />
      </section>

      {/* Action Items */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ListChecks size={15} className="text-muted-foreground" />
            Action Items
            {openItems.length > 0 && (
              <span
                className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {openItems.length} open
              </span>
            )}
          </h2>
        </div>

        <ActionItemsSection
          projectId={id}
          items={project.actionItems.map((item) => ({
            id: item.id,
            description: item.description,
            ownerId: item.ownerId,
            ownerName: item.owner ? getDisplayName(item.owner) : null,
            deadline: item.deadline?.toISOString() ?? null,
            status: item.status,
            carriedOver: item.carriedOver,
          }))}
          assignees={project.assignments.map((a) => ({ id: a.userId, name: getDisplayName(a.user) }))}
          canCreate={canCreateActionItem}
          canClose={canCloseActionItems}
          currentUserId={user.id}
        />
      </section>

      {/* Team */}
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
          <div className="grid grid-cols-2 gap-2">
            {project.assignments.map((a) => (
              <div
                key={a.userId}
                className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg"
              >
                <Users size={13} className="text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {getDisplayName(a.user)}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.role.toLowerCase()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer links */}
      <div className="pt-2 border-t border-border flex items-center gap-6">
        <Link
          href={`/projects/${id}/timeline`}
          className="text-xs text-muted-foreground clickable-icon"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          View timeline →
        </Link>
        <Link
          href={`/projects/${id}/history`}
          className="text-xs text-muted-foreground clickable-icon"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Project Standing History →
        </Link>
      </div>

      {/* Recent Project Standings */}
      {project.statusUpdates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Project Standings</h2>
          <div className="space-y-3">
            {project.statusUpdates.map((update) => (
              <div key={update.id} className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {update.meetingDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    &middot; {getDisplayName(update.submittedBy)}
                  </span>
                  {update.isLate && (
                    <span
                      className="text-xs text-[#A4503C] bg-[#FDEBEC] px-1.5 py-0.5 rounded"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Late
                    </span>
                  )}
                  {canModifyStatusUpdate(update) && (
                    <StatusUpdateControls
                      update={{
                        id: update.id,
                        plannedWork: update.plannedWork,
                        actualProgress: update.actualProgress,
                        blockers: update.blockers,
                        nextWeekGoals: update.nextWeekGoals,
                        needsHelp: update.needsHelp,
                        helpNeeded: update.helpNeeded,
                      }}
                    />
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
                    {formatDateOnly(record.meetingDate, { weekday: "short", month: "short", day: "numeric" })}
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
                    {canManageMeetingRecords && (
                      <MeetingRecordControls recordId={record.id} />
                    )}
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
