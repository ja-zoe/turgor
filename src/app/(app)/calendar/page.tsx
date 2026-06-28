import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission, type CalendarEventType } from "@/generated/prisma";
import { SemesterCalendar } from "@/components/semester-calendar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const { semester: semesterParam } = await searchParams;
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canEdit = permissions.includes(Permission.MANAGE_CALENDAR);
  // Only leads / eboard / PM (VIEW_LEAD_MEETINGS) may see lead + eboard meetings.
  const canSeeRestrictedMeetings = permissions.includes(Permission.VIEW_LEAD_MEETINGS);
  const restrictedFilter = canSeeRestrictedMeetings
    ? {}
    : { type: { notIn: ["LEAD_MEETING", "EBOARD_MEETING"] as CalendarEventType[] } };

  // Collect all known semesters from both Projects and CalendarEvents
  const [projectSemesters, eventSemesters, datedEvents] = await Promise.all([
    prisma.project.findMany({ select: { semester: true }, distinct: ["semester"] }),
    prisma.calendarEvent.findMany({ select: { semester: true }, distinct: ["semester"] }),
    prisma.calendarEvent.findMany({ select: { semester: true, semesters: true, startsAt: true } }),
  ]);

  const projectSemesterSet = new Set(projectSemesters.map((p) => p.semester));
  const knownSemesters = [...new Set([
    ...projectSemesters.map((p) => p.semester),
    ...eventSemesters.map((e) => e.semester),
  ])];

  // Semesters are free-text strings with no intrinsic dates, so a string sort is
  // meaningless. "Current semester" is best signalled by where the *projects* are, so
  // rank project-bearing semesters first; within each group break ties by which
  // semester's events are nearest *today* (a lead/eboard meeting counts for every
  // semester it's pinned to). This keeps the default off a stale, event-only semester.
  const now = Date.now();
  const distanceToNow = (semester: string) => {
    let min = Infinity;
    for (const e of datedEvents) {
      if (e.semester === semester || e.semesters.includes(semester)) {
        min = Math.min(min, Math.abs(e.startsAt.getTime() - now));
      }
    }
    return min;
  };
  const allSemesters = knownSemesters
    .map((s) => ({ s, hasProjects: projectSemesterSet.has(s), d: distanceToNow(s) }))
    .sort((a, b) => (Number(b.hasProjects) - Number(a.hasProjects)) || (a.d - b.d))
    .map((x) => x.s);

  // Active semester: explicit param wins; otherwise the current semester (projects first,
  // then nearest today).
  const activeSemester = semesterParam ?? allSemesters[0] ?? "";

  const events = activeSemester
    ? await prisma.calendarEvent.findMany({
        // A lead/eboard meeting pinned to several semesters shows in each of them.
        where: { semesters: { has: activeSemester }, ...restrictedFilter },
        orderBy: { startsAt: "asc" },
        include: { project: { select: { name: true } } },
      })
    : [];

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, semester: true },
    orderBy: { name: "asc" },
  });

  return (
    <SemesterCalendar
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        semester: e.semester,
        semesters: e.semesters,
        type: e.type,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
        allDay: e.allDay,
        location: e.location,
        description: e.description,
        projectId: e.projectId,
        projectName: e.project?.name ?? null,
      }))}
      canEdit={canEdit}
      semester={activeSemester}
      allSemesters={allSemesters}
      projects={projects}
    />
  );
}
