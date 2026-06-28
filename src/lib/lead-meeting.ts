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
