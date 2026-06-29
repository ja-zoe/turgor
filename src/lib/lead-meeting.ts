import { prisma } from "@/lib/prisma";

export type PendingLeadMeeting = {
  meeting: { id: string; title: string; startsAt: Date };
  /** True once we're past the meeting's start time — the submission is late but still allowed. */
  isLate: boolean;
};

/**
 * Every lead meeting a project currently owes a status update for, soonest-first.
 *
 * Lead meetings are **global per semester** (the PM schedules them on the calendar for
 * all leads — not tied to a single project). A meeting is **pinned to a set of semesters**
 * (`CalendarEvent.semesters`) and governs every project whose `semester` is in that set.
 *
 * A meeting is **pending** for a project when its submission window is open and no update
 * has been submitted for it yet. The window runs from `statusSubmitWindowDays` *before*
 * the meeting (on-time) until `statusLateWindowDays` *after* it (late, but still allowed);
 * outside that range the meeting is either not yet open or considered missed and drops off.
 * Several meetings can be pending at once — they are all returned.
 */
export async function getPendingLeadMeetings(projectId: string): Promise<PendingLeadMeeting[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { semester: true },
  });
  if (!project) return [];

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const submitWindowDays = settings?.statusSubmitWindowDays ?? 3;
  const lateWindowDays = settings?.statusLateWindowDays ?? 3;
  const now = new Date();
  // window open  ⇔  startsAt - submitWindow <= now <= startsAt + lateWindow
  //            ⇔  now - lateWindow <= startsAt <= now + submitWindow
  const earliestStart = new Date(now.getTime() - lateWindowDays * 86_400_000);
  const latestStart = new Date(now.getTime() + submitWindowDays * 86_400_000);

  const meetings = await prisma.calendarEvent.findMany({
    where: {
      type: "LEAD_MEETING",
      semesters: { has: project.semester },
      startsAt: { gte: earliestStart, lte: latestStart },
      // not yet submitted for this project
      statusUpdates: { none: { projectId } },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

  return meetings.map((meeting) => ({ meeting, isLate: now > meeting.startsAt }));
}

/**
 * Submission state for a project's "Submit Project Standing" affordance:
 *  - `pending`  — the full list of lead meetings awaiting a status update (soonest-first),
 *  - `count`    — how many,
 *  - `canSubmit`— whether any are pending.
 */
export async function getStatusSubmissionState(projectId: string) {
  const pending = await getPendingLeadMeetings(projectId);
  return { pending, count: pending.length, canSubmit: pending.length > 0 };
}
