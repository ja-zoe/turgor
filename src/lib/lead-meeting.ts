import { prisma } from "@/lib/prisma";

/**
 * The project's "active" lead meeting for status submission, or null.
 *
 * A LEAD_MEETING's submission window opens `statusSubmitWindowDays` before it. We
 * pick the **latest** lead meeting whose window has opened (`startsAt - window <= now`),
 * which is the upcoming one once we're inside its window, or the most recent past one
 * (so late submissions are still allowed until the next meeting's window opens).
 * `isLate` is true once we're past the meeting's start time.
 */
export async function getActiveLeadMeeting(projectId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const windowDays = settings?.statusSubmitWindowDays ?? 3;
  const now = new Date();
  // window has opened  ⇔  startsAt - windowDays <= now  ⇔  startsAt <= now + windowDays
  const windowEnd = new Date(now.getTime() + windowDays * 86_400_000);

  const meeting = await prisma.calendarEvent.findFirst({
    where: { projectId, type: "LEAD_MEETING", startsAt: { lte: windowEnd } },
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
