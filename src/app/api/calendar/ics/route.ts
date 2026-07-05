import { NextRequest, NextResponse } from "next/server";
import { getUserPermissions } from "@/lib/permissions";
import { resolveActiveOrg } from "@/lib/tenant";
import { forOrg } from "@/lib/tenant-db";
import { Permission } from "@/generated/prisma";
import { buildIcs } from "@/lib/calendar-export";
import { getOrgSettings } from "@/lib/org";
import { orgSlug } from "@/lib/utils";

// GET /api/calendar/ics[?semester=...] — the requesting user's visible events as an
// .ics download. Lead/eboard meetings are excluded for users without VIEW_LEAD_MEETINGS
// (same rule as the in-app calendar), so a general member's export omits them.
export async function GET(req: NextRequest) {
  const t = await resolveActiveOrg();
  if (!t) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const permissions = await getUserPermissions(t.roleId);
  const canSeeRestricted = permissions.includes(Permission.VIEW_LEAD_MEETINGS);
  const semester = req.nextUrl.searchParams.get("semester") || undefined;

  const db = forOrg(t.orgId);
  const events = await db.calendarEvent.findMany({
    where: {
      ...(semester ? { semester } : {}),
      ...(canSeeRestricted ? {} : { type: { notIn: ["LEAD_MEETING", "EBOARD_MEETING"] } }),
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true, endsAt: true, allDay: true, location: true, description: true },
  });

  const { orgName, appName, periodLabel } = await getOrgSettings(t.orgId);
  const ics = buildIcs(events, appName, periodLabel);
  const slug = orgSlug(orgName);
  const filename = semester ? `${slug}-${semester.replace(/\s+/g, "-")}.ics` : `${slug}-calendar.ics`;
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
