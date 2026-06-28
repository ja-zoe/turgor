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
  const [projectSemesters, eventSemesters] = await Promise.all([
    prisma.project.findMany({ select: { semester: true }, distinct: ["semester"] }),
    prisma.calendarEvent.findMany({ select: { semester: true }, distinct: ["semester"] }),
  ]);

  const allSemesters = [...new Set([
    ...projectSemesters.map((p) => p.semester),
    ...eventSemesters.map((e) => e.semester),
  ])].sort().reverse();

  // Active semester: from query param, or most recent known
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
