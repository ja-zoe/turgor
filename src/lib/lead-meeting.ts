import { prisma } from "@/lib/prisma";

/**
 * The "active" lead meeting whose submission window is open for a project, or null.
 *
 * Lead meetings are **global per semester** (the PM schedules them on the calendar for
 * all leads — they are not tied to a single project). A lead meeting is **pinned to a
 * set of semesters** (`CalendarEvent.semesters`); it governs every project whose
 * `semester` is in that set. A meeting's window opens `statusSubmitWindowDays`
 * before it; we pick the **latest** meeting whose window has opened
 * (`startsAt - window <= now`), so when the PM schedules meetings on consecutive days
 * the windows overlap into one continuous submission period. `isLate` is true once
 * we're past that meeting's start time.
 */
export async function getActiveLeadMeeting(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { semester: true },
  });
  if (!project) return null;

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const windowDays = settings?.statusSubmitWindowDays ?? 3;
  const now = new Date();
  // window has opened  ⇔  startsAt - windowDays <= now  ⇔  startsAt <= now + windowDays
  const windowEnd = new Date(now.getTime() + windowDays * 86_400_000);

  const meeting = await prisma.calendarEvent.findFirst({
    where: {
      type: "LEAD_MEETING",
      semesters: { has: project.semester },
      startsAt: { lte: windowEnd },
    },
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, startsAt: true },
  });
  if (!meeting) return null;
  return { meeting, isLate: now > meeting.startsAt };
}

/**
 * Whether the "Submit Update" affordance should appear for a project: there is an
 * active lead meeting (inside its submit window) AND no update has been submitted
 * for that meeting yet. Hidden once submitted or outside the window.
 */
export async function getStatusSubmissionState(projectId: string) {
  const active = await getActiveLeadMeeting(projectId);
  if (!active) return { active: null, submitted: false, canSubmit: false };
  const existing = await prisma.statusUpdate.findFirst({
    where: { projectId, calendarEventId: active.meeting.id },
    select: { id: true },
  });
  return { active, submitted: !!existing, canSubmit: !existing };
}
