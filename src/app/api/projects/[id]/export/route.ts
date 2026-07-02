import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions, getProjectMembership } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { getDisplayName } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const permissions = await getUserPermissions(session.user.roleId ?? null);
  const canViewAll =
    permissions.includes(Permission.VIEW_ALL_PROJECTS) ||
    permissions.includes(Permission.MANAGE_PROJECTS);
  const membership = await getProjectMembership(session.user.id, id);
  if (!membership && !canViewAll) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      deliverables: {
        orderBy: { orderIndex: "asc" },
        include: {
          subtasks: {
            orderBy: { orderIndex: "asc" },
            include: {
              assignee: { select: { name: true, firstName: true, nickname: true, email: true } },
            },
          },
        },
      },
      meetingRecords: {
        orderBy: { meetingDate: "asc" },
        include: {
          recordedBy: { select: { name: true, firstName: true, nickname: true, email: true } },
        },
      },
      statusUpdates: {
        orderBy: { meetingDate: "asc" },
        include: {
          submittedBy: { select: { name: true, firstName: true, nickname: true, email: true } },
        },
      },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SEED Tracker";
  workbook.created = new Date();

  // ── Sheet 1: Timeline ────────────────────────────────────────────────────
  const tlSheet = workbook.addWorksheet("Timeline");
  tlSheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Title", key: "title", width: 36 },
    { header: "Status", key: "status", width: 14 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "Target / Due Date", key: "targetDate", width: 16 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Assignee", key: "assignee", width: 22 },
  ];
  // Header style
  tlSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  tlSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4034" },
  };

  const addDeliverableRows = (d: (typeof project.deliverables)[number], type: string) => {
    tlSheet.addRow({
      type,
      title: d.title,
      status: d.status,
      startDate: d.startDate ?? "",
      targetDate: d.targetDate,
      completed: d.completed ? "Yes" : "No",
      assignee: "",
    });
    for (const s of d.subtasks) {
      tlSheet.addRow({
        type: "  Subtask",
        title: s.title,
        status: s.status,
        startDate: s.startDate ?? "",
        targetDate: s.dueDate ?? "",
        completed: s.status === "COMPLETE" ? "Yes" : "No",
        assignee: s.assignee
          ? getDisplayName(s.assignee)
          : "",
      });
    }
  };

  for (const d of project.deliverables.filter((d) => !d.backlog)) {
    addDeliverableRows(d, "Deliverable");
  }
  // Backlogged deliverables export under their own divider rather than silently dropping.
  const backlogDelivs = project.deliverables.filter((d) => d.backlog);
  if (backlogDelivs.length > 0) {
    const divider = tlSheet.addRow({ type: "Backlog", title: "— deferred deliverables —" });
    divider.font = { bold: true, color: { argb: "FF787774" } };
    for (const d of backlogDelivs) {
      addDeliverableRows(d, "Backlog");
    }
  }

  // ── Sheet 2: Project Standings ───────────────────────────────────────────────
  const suSheet = workbook.addWorksheet("Project Standings");
  suSheet.columns = [
    { header: "Meeting Date", key: "meetingDate", width: 14 },
    { header: "Submitted By", key: "submittedBy", width: 22 },
    { header: "Late", key: "isLate", width: 8 },
    { header: "Planned Work", key: "plannedWork", width: 40 },
    { header: "Actual Progress", key: "actualProgress", width: 40 },
    { header: "Blockers", key: "blockers", width: 40 },
    { header: "Next Week Goals", key: "nextWeekGoals", width: 40 },
    { header: "Help Needed", key: "helpNeeded", width: 30 },
  ];
  suSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  suSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4034" },
  };

  for (const u of project.statusUpdates) {
    suSheet.addRow({
      meetingDate: u.meetingDate,
      submittedBy: getDisplayName(u.submittedBy),
      isLate: u.isLate ? "Yes" : "No",
      plannedWork: u.plannedWork,
      actualProgress: u.actualProgress,
      blockers: u.blockers ?? "",
      nextWeekGoals: u.nextWeekGoals ?? "",
      helpNeeded: u.needsHelp ? (u.helpNeeded ?? "") : "",
    });
  }

  // ── Sheet 3: Meeting Records ──────────────────────────────────────────────
  const mrSheet = workbook.addWorksheet("Meeting Records");
  mrSheet.columns = [
    { header: "Meeting Date", key: "meetingDate", width: 14 },
    { header: "Recorded By", key: "recordedBy", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Goal Met", key: "goalMet", width: 10 },
    { header: "Key Blockers", key: "keyBlockers", width: 40 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  mrSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  mrSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4034" },
  };

  for (const r of project.meetingRecords) {
    mrSheet.addRow({
      meetingDate: r.meetingDate,
      recordedBy: getDisplayName(r.recordedBy),
      status: r.status,
      goalMet: r.goalMet === true ? "Yes" : r.goalMet === false ? "No" : "N/A",
      keyBlockers: r.keyBlockers ?? "",
      notes: r.notes ?? "",
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_timeline.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
