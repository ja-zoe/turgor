import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUserPermissions } from "@/lib/permissions";
import { resolveActiveOrg } from "@/lib/tenant";
import { forOrg } from "@/lib/tenant-db";
import { Permission } from "@/generated/prisma";
import { getOrgSettings } from "@/lib/org";
import { themePrimaryHex } from "@/lib/themes";
import { getDisplayName, orgSlug } from "@/lib/utils";

/** Excel sheet names cap at 31 chars and ban \ / * ? : [ ] — sanitize + dedupe. */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Project";
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) candidate = `${base.slice(0, 24)} (${i++})`;
  used.add(candidate);
  return candidate;
}

export async function GET(req: NextRequest) {
  const t = await resolveActiveOrg();
  if (!t) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const permissions = await getUserPermissions(t.roleId);
  if (!permissions.includes(Permission.VIEW_MONTHLY_REVIEW)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const semester = req.nextUrl.searchParams.get("semester")?.trim() || null;

  const db = forOrg(t.orgId);
  const projects = await db.project.findMany({
    where: { archivedAt: null, ...(semester ? { semester } : {}) },
    orderBy: { name: "asc" },
    include: {
      assignments: {
        where: { role: { in: ["LEAD", "SUBLEAD"] } },
        include: {
          user: { select: { name: true, firstName: true, nickname: true, email: true } },
        },
      },
      deliverables: {
        orderBy: { orderIndex: "asc" },
        select: { title: true, status: true, targetDate: true, completed: true, backlog: true },
      },
      statusUpdates: {
        orderBy: { meetingDate: "desc" },
        take: 5,
        include: {
          submittedBy: { select: { name: true, firstName: true, nickname: true, email: true } },
        },
      },
      _count: { select: { actionItems: { where: { status: "OPEN" } } } },
    },
  });

  const org = await getOrgSettings(t.orgId);
  const headerArgb = `FF${themePrimaryHex(org.themePreset).slice(1)}`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = org.appName;
  workbook.created = new Date();

  const styleHeader = (sheet: ExcelJS.Worksheet) => {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerArgb },
    };
  };

  // ── Sheet 1: Overview — one row per active project ─────────────────────────
  const overview = workbook.addWorksheet("Overview");
  overview.columns = [
    { header: "Project", key: "name", width: 32 },
    { header: org.periodLabel, key: "semester", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Leads", key: "leads", width: 30 },
    { header: "Deliverables Done", key: "deliverables", width: 18 },
    { header: "Open Action Items", key: "openItems", width: 18 },
    { header: "Last Standing", key: "lastStanding", width: 14 },
  ];
  styleHeader(overview);

  for (const p of projects) {
    const active = p.deliverables.filter((d) => !d.backlog);
    overview.addRow({
      name: p.name,
      semester: p.semester,
      status: p.status,
      leads: p.assignments.map((a) => getDisplayName(a.user)).join(", "),
      deliverables: `${active.filter((d) => d.completed).length}/${active.length}`,
      openItems: p._count.actionItems,
      lastStanding: p.statusUpdates[0]?.meetingDate ?? "",
    });
  }

  // ── One summary sheet per project: deliverables + recent standings ─────────
  const usedNames = new Set<string>(["Overview"]);
  for (const p of projects) {
    const sheet = workbook.addWorksheet(sheetName(p.name, usedNames));
    sheet.columns = [
      { header: "Deliverable", key: "a", width: 36 },
      { header: "Status", key: "b", width: 14 },
      { header: "Target Date", key: "c", width: 14 },
      { header: "Completed", key: "d", width: 12 },
    ];
    styleHeader(sheet);
    for (const d of p.deliverables.filter((d) => !d.backlog)) {
      sheet.addRow({ a: d.title, b: d.status, c: d.targetDate, d: d.completed ? "Yes" : "No" });
    }

    sheet.addRow({});
    const standingsHeader = sheet.addRow({
      a: "Recent Standings",
      b: "Submitted By",
      c: "Meeting Date",
      d: "Blockers",
    });
    standingsHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    standingsHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerArgb },
    };
    for (const u of p.statusUpdates) {
      sheet.addRow({
        a: u.actualProgress,
        b: getDisplayName(u.submittedBy),
        c: u.meetingDate,
        d: u.blockers ?? "",
      });
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  const periodSlug = semester ? orgSlug(semester) : "all";
  const filename = `${orgSlug(org.orgName)}-${periodSlug}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
