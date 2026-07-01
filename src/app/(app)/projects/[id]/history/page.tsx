import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth, getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { ProjectStatusBadge } from "@/components/status-badge";
import { MeetingRecordControls } from "@/components/meeting-record-controls";
import { StatusUpdateControls } from "@/components/status-update-controls";
import { ArrowLeft, ClipboardText, CalendarCheck, Clock } from "@phosphor-icons/react/dist/ssr";
import { getDisplayName, formatDateOnly } from "@/lib/utils";

export default async function ProjectHistoryPage({
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
  const canManageMeetingRecords = permissions.includes(Permission.MANAGE_MEETING_RECORDS);
  const canManageStatusUpdates = permissions.includes(Permission.MANAGE_STATUS_UPDATES);

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      semester: true,
      statusUpdates: {
        orderBy: { meetingDate: "desc" },
        include: {
          submittedBy: { select: { name: true, firstName: true, nickname: true, email: true } },
          calendarEvent: { select: { startsAt: true } },
        },
      },
      meetingRecords: {
        orderBy: { meetingDate: "desc" },
        include: {
          recordedBy: { select: { name: true, firstName: true, nickname: true, email: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const membership = await getProjectMembership(user.id, id);
  if (!membership && !canViewAll) notFound();

  const isLeadHere = membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  // Same gate as the project detail page: privileged (MANAGE_STATUS_UPDATES) any time, or
  // the submitting lead/sublead before the linked meeting's start time (its due time).
  const canModifyStatusUpdate = (u: {
    submittedById: string;
    meetingDate: Date;
    calendarEvent: { startsAt: Date } | null;
  }) =>
    canManageStatusUpdates ||
    (u.submittedById === user.id &&
      isLeadHere &&
      new Date() <= new Date(u.calendarEvent?.startsAt ?? u.meetingDate));

  // Merge and sort all events chronologically (newest first)
  type StatusEntry = { kind: "status"; date: Date; data: (typeof project.statusUpdates)[number] };
  type MeetingEntry = { kind: "meeting"; date: Date; data: (typeof project.meetingRecords)[number] };
  type Entry = StatusEntry | MeetingEntry;

  const events: Entry[] = [
    ...project.statusUpdates.map((s) => ({
      kind: "status" as const,
      date: s.meetingDate,
      data: s,
    })),
    ...project.meetingRecords.map((m) => ({
      kind: "meeting" as const,
      date: m.meetingDate,
      data: m,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground clickable mb-4"
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
          Project Standing History
        </h1>
        <p
          className="text-xs text-muted-foreground mt-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {project.semester} &middot; {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <Clock size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline spine */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-3 pl-10">
            {events.map((event) => {
              // Meeting-record dates are date-only (UTC midnight) → format in UTC; status-update
              // dates derive from the lead meeting's real datetime → format local.
              const dateOpts = { weekday: "short", month: "short", day: "numeric", year: "numeric" } as const;
              const dateLabel =
                event.kind === "meeting"
                  ? formatDateOnly(event.date, dateOpts)
                  : event.date.toLocaleDateString("en-US", dateOpts);

              if (event.kind === "status") {
                const s = event.data;
                return (
                  <div key={`status-${s.id}`} className="relative">
                    {/* Timeline node */}
                    <div className="absolute -left-[30px] top-3 w-4 h-4 rounded-full bg-card border-2 border-border flex items-center justify-center">
                      <ClipboardText size={8} className="text-muted-foreground" />
                    </div>

                    <div className="p-4 bg-card border border-border rounded-xl">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded bg-[#E1F3FE] text-[#1F6C9F]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          Project Standing
                        </span>
                        <span
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {dateLabel}
                        </span>
                        <span
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          by{" "}
                          {getDisplayName(s.submittedBy)}
                        </span>
                        {s.isLate && (
                          <span
                            className="text-xs text-[#A4503C] bg-[#FDEBEC] px-1.5 py-0.5 rounded"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            Late
                          </span>
                        )}
                        {canModifyStatusUpdate(s) && (
                          <StatusUpdateControls
                            update={{
                              id: s.id,
                              plannedWork: s.plannedWork,
                              actualProgress: s.actualProgress,
                              blockers: s.blockers,
                              nextWeekGoals: s.nextWeekGoals,
                              needsHelp: s.needsHelp,
                              helpNeeded: s.helpNeeded,
                            }}
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Planned</p>
                          <p className="text-xs text-foreground">{s.plannedWork}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Actual</p>
                          <p className="text-xs text-foreground">{s.actualProgress}</p>
                        </div>
                        {s.blockers && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Blockers
                            </p>
                            <p className="text-xs text-foreground">{s.blockers}</p>
                          </div>
                        )}
                        {s.nextWeekGoals && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Next Week
                            </p>
                            <p className="text-xs text-foreground">{s.nextWeekGoals}</p>
                          </div>
                        )}
                        {s.needsHelp && s.helpNeeded && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-[#C99846] mb-1">Help Needed</p>
                            <p className="text-xs text-foreground">{s.helpNeeded}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const m = event.data;
              return (
                <div key={`meeting-${m.id}`} className="relative">
                  <div className="absolute -left-[30px] top-3 w-4 h-4 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                    <CalendarCheck size={8} className="text-primary" />
                  </div>

                  <div className="p-4 bg-card border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded bg-[#EDF3EC] text-[#588157]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Meeting Record
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {dateLabel}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        by {getDisplayName(m.recordedBy)}
                      </span>
                      {canManageMeetingRecords && (
                        <span className="ml-auto">
                          <MeetingRecordControls recordId={m.id} />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <ProjectStatusBadge status={m.status} />
                      {m.goalMet !== null && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            m.goalMet
                              ? "bg-[#EDF3EC] text-[#588157]"
                              : "bg-[#FDEBEC] text-[#A4503C]"
                          }`}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          Goal {m.goalMet ? "Met" : "Missed"}
                        </span>
                      )}
                    </div>

                    {m.keyBlockers && (
                      <div className="mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Blockers</p>
                        <p className="text-xs text-foreground">{m.keyBlockers}</p>
                      </div>
                    )}
                    {m.notes && (
                      <p className="text-xs text-muted-foreground">{m.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
