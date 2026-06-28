import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { buildIcs } from "@/lib/calendar-export";

// GET /api/calendar/ics[?semester=...] — the requesting user's visible events as an
// .ics download. Lead/eboard meetings are excluded for users without VIEW_LEAD_MEETINGS
// (same rule as the in-app calendar), so a general member's export omits them.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const permissions = await getUserPermissions(session.user.roleId ?? null);
  const canSeeRestricted = permissions.includes(Permission.VIEW_LEAD_MEETINGS);
  const semester = req.nextUrl.searchParams.get("semester") || undefined;

  const events = await prisma.calendarEvent.findMany({
    where: {
      ...(semester ? { semester } : {}),
      ...(canSeeRestricted ? {} : { type: { notIn: ["LEAD_MEETING", "EBOARD_MEETING"] } }),
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true, endsAt: true, allDay: true, location: true, description: true },
  });

  const ics = buildIcs(events);
  const filename = semester ? `seed-${semester.replace(/\s+/g, "-")}.ics` : "seed-calendar.ics";
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
