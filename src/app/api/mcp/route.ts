import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Permission, TimelineStatus, ActionItemStatus, CalendarEventType, ProjectStatus, McpConnectionType, Priority } from "@/generated/prisma";
import { carryOverActionItems } from "@/lib/actions/action-items";
import { getPendingLeadMeetings } from "@/lib/lead-meeting";
import { runRedFlagDetection } from "@/lib/red-flag";
import { verifyOAuthAccessToken, looksLikeJwt, type McpUser } from "@/lib/mcp-oauth";

// Lead/eboard meetings are hidden from users without VIEW_LEAD_MEETINGS — mirrors
// calendar/page.tsx and api/calendar/ics/route.ts.
const RESTRICTED_EVENT_TYPES: CalendarEventType[] = [
  CalendarEventType.LEAD_MEETING,
  CalendarEventType.EBOARD_MEETING,
];


const TOOLS = [
  // ── Read ──────────────────────────────────────────────────────────────────
  {
    name: "list_projects",
    description: "List all SEED projects the current user has access to.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_project_detail",
    description: "Get deliverables and open action items for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_members",
    description:
      "List users with optional filtering. Use roleName='Project Manager' to list eboard. Requires VIEW_ALL_PROJECTS to query across the org; otherwise scoped to the caller's projects.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Filter to members of this project" },
        projectRole: {
          type: "string",
          enum: ["LEAD", "SUBLEAD", "MEMBER"],
          description: "Filter by project role (only meaningful with projectId)",
        },
        roleName: {
          type: "string",
          description: "Filter by global role name, e.g. 'Project Manager'",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PENDING", "SUSPENDED"],
          description: "Filter by account status (default: ACTIVE)",
        },
      },
      required: [],
    },
  },
  {
    name: "list_action_items",
    description: "Query action items with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Restrict to a specific project" },
        status: { type: "string", enum: ["OPEN", "DONE"], description: "Filter by status" },
        assignedToMe: {
          type: "boolean",
          description: "If true, only return items where the caller is the owner",
        },
      },
      required: [],
    },
  },
  {
    name: "get_my_subtasks",
    description: "Return all subtasks assigned to the calling user.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"],
          description: "Filter by status",
        },
      },
      required: [],
    },
  },
  // ── Projects ──────────────────────────────────────────────────────────────
  {
    name: "create_project",
    description:
      "Create a new project. Requires MANAGE_PROJECTS permission.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        semester: { type: "string", description: "e.g. 'Fall 2026'" },
        description: { type: "string" },
        startDate: { type: "string", description: "ISO date string (optional)" },
        endDate: { type: "string", description: "ISO date string (optional)" },
      },
      required: ["name", "semester"],
    },
  },
  {
    name: "update_project",
    description:
      "Update a project's name, semester, description, dates, or corrective action plan. Requires MANAGE_PROJECTS permission.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        name: { type: "string" },
        semester: { type: "string" },
        description: { type: "string" },
        startDate: { type: "string", description: "ISO date string, or null to clear" },
        endDate: { type: "string", description: "ISO date string, or null to clear" },
        correctiveActionPlan: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  // ── Action items ──────────────────────────────────────────────────────────
  {
    name: "create_action_item",
    description:
      "Create an action item on a project. Requires LEAD, SUBLEAD, or ASSIGN_ACTION_ITEMS permission.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        description: { type: "string" },
        deadline: { type: "string", description: "ISO date string e.g. 2026-07-15 (optional)" },
        ownerId: {
          type: "string",
          description:
            "User ID to assign as owner (use list_members to find one). Defaults to the caller if omitted; pass an empty string for no owner.",
        },
      },
      required: ["projectId", "description"],
    },
  },
  {
    name: "update_action_item",
    description:
      "Close, reopen, or edit an action item (including reassigning its owner). Requires CLOSE_ACTION_ITEMS, ASSIGN_ACTION_ITEMS, or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        actionItemId: { type: "string" },
        status: { type: "string", enum: ["OPEN", "DONE"] },
        deadline: { type: "string", description: "ISO date string, or null to clear" },
        description: { type: "string" },
        ownerId: {
          type: "string",
          description: "User ID to reassign as owner, or an empty string to clear the owner",
        },
      },
      required: ["actionItemId"],
    },
  },
  {
    name: "delete_action_item",
    description:
      "Delete an action item. Requires CLOSE_ACTION_ITEMS, ASSIGN_ACTION_ITEMS, or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        action_item_id: { type: "string" },
      },
      required: ["action_item_id"],
    },
  },
  // ── Status updates ────────────────────────────────────────────────────────
  {
    name: "create_status_update",
    description:
      "Submit a weekly project standing. Submitted against the soonest lead meeting currently awaiting a standing update for this project, unless calendarEventId names a different pending one; the meeting date and late flag are derived from that meeting. Fails if no lead meeting is currently open for submission.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        plannedWork: { type: "string" },
        actualProgress: { type: "string" },
        blockers: { type: "string", description: "Describe blockers, or 'None'" },
        nextWeekGoals: { type: "string" },
        calendarEventId: {
          type: "string",
          description:
            "ID of the pending lead meeting to submit for. Omit to use the soonest one awaiting a standing update.",
        },
        needsHelp: { type: "boolean", description: "Flag that the project needs help (optional)" },
        helpNeeded: { type: "string", description: "What help is needed (only used when needsHelp is true)" },
      },
      required: [
        "projectId",
        "plannedWork",
        "actualProgress",
        "blockers",
        "nextWeekGoals",
      ],
    },
  },
  {
    name: "list_status_updates",
    description:
      "List submitted project standing updates. Scoped to the caller's projects unless VIEW_ALL_PROJECTS.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Restrict to a specific project" },
        limit: { type: "number", description: "Max rows (default 20, max 50)" },
      },
      required: [],
    },
  },
  // ── Meeting records ───────────────────────────────────────────────────────
  {
    name: "list_meeting_records",
    description:
      "List post-meeting tracking records for a project (status, goal met, blockers, notes), newest first.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        limit: { type: "number", description: "Max rows (default 20, max 50)" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_meeting_record",
    description:
      "Record a post-meeting tracking entry for a project. Requires POST_MEETING_TRACKING. Applies the chosen status to the project (unless overridden) and re-runs red-flag detection.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        meetingDate: { type: "string", description: "ISO date string" },
        status: { type: "string", enum: ["ON_TRACK", "AT_RISK", "BEHIND"] },
        goalMet: { type: "boolean", description: "Whether the weekly goal was met (optional)" },
        keyBlockers: { type: "string", description: "Blockers (optional)" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["projectId", "meetingDate", "status"],
    },
  },
  {
    name: "delete_meeting_record",
    description:
      "Delete a meeting record. Requires MANAGE_MEETING_RECORDS. Action items carried at that meeting are preserved.",
    inputSchema: {
      type: "object",
      properties: {
        meetingRecordId: { type: "string" },
      },
      required: ["meetingRecordId"],
    },
  },
  // ── Deliverables ──────────────────────────────────────────────────────────
  {
    name: "create_deliverable",
    description:
      "Create a deliverable on a project. Requires MANAGE_MILESTONES or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        title: { type: "string" },
        targetDate: { type: "string", description: "ISO date string" },
        description: { type: "string" },
        startDate: { type: "string", description: "ISO date string (optional)" },
        group: { type: "string", description: "Group/phase label (optional)" },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "Priority (optional, defaults to MEDIUM). Primary sort key for deliverables.",
        },
      },
      required: ["projectId", "title", "targetDate"],
    },
  },
  {
    name: "update_deliverable",
    description:
      "Update a deliverable's title, dates, status, group, priority, or backlog state (backlog: true defers it off the semester timeline and red-flag detection; false restores it). Requires MANAGE_MILESTONES or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        deliverableId: { type: "string" },
        title: { type: "string" },
        targetDate: { type: "string", description: "ISO date string" },
        startDate: { type: "string", description: "ISO date string, or null to clear" },
        description: { type: "string" },
        status: {
          type: "string",
          enum: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"],
        },
        group: { type: "string" },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "Priority (LOW, MEDIUM, or HIGH)",
        },
        backlog: {
          type: "boolean",
          description: "true moves the deliverable to the backlog (deferred), false restores it to the active plan",
        },
      },
      required: ["deliverableId"],
    },
  },
  {
    name: "delete_deliverable",
    description:
      "Delete a deliverable and all its subtasks. Requires MANAGE_MILESTONES or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        deliverableId: { type: "string" },
      },
      required: ["deliverableId"],
    },
  },
  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    name: "list_calendar_events",
    description: "List calendar events, optionally filtered by semester, date range, or type. Read-only. Lead/eboard meetings are only returned to users with VIEW_LEAD_MEETINGS.",
    inputSchema: {
      type: "object",
      properties: {
        semester: { type: "string", description: "Filter by semester (e.g. 'Fall 2026')" },
        from: { type: "string", description: "ISO date — only events on/after this date" },
        to: { type: "string", description: "ISO date — only events on/before this date" },
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT", "LEAD_MEETING", "EBOARD_MEETING"] },
      },
      required: [],
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a calendar event. Requires MANAGE_CALENDAR permission.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        semester: { type: "string" },
        startsAt: { type: "string", description: "ISO datetime" },
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT", "LEAD_MEETING", "EBOARD_MEETING"], description: "Default: PROJECT_MEETING" },
        semesters: { type: "array", items: { type: "string" }, description: "Semesters a lead/eboard meeting governs. Defaults to [semester] for LEAD_MEETING/EBOARD_MEETING." },
        endsAt: { type: "string", description: "ISO datetime (optional)" },
        allDay: { type: "boolean" },
        location: { type: "string" },
        description: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["title", "semester", "startsAt"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Update a calendar event. Requires MANAGE_CALENDAR permission.",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string" },
        title: { type: "string" },
        semester: { type: "string" },
        startsAt: { type: "string", description: "ISO datetime" },
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT", "LEAD_MEETING", "EBOARD_MEETING"] },
        semesters: { type: "array", items: { type: "string" }, description: "Semesters a lead/eboard meeting governs" },
        endsAt: { type: "string", description: "ISO datetime, or null to clear" },
        allDay: { type: "boolean" },
        location: { type: "string" },
        description: { type: "string" },
        projectId: { type: "string", description: "Project ID, or null to unlink" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete a calendar event. Requires MANAGE_CALENDAR permission.",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string" },
      },
      required: ["eventId"],
    },
  },
  // ── Subtasks ──────────────────────────────────────────────────────────────
  {
    name: "create_subtask",
    description:
      "Create a subtask on a deliverable. Requires project membership or MANAGE_MILESTONES.",
    inputSchema: {
      type: "object",
      properties: {
        deliverableId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        startDate: { type: "string", description: "ISO date string (optional)" },
        dueDate: { type: "string", description: "ISO date string (optional)" },
        assigneeId: { type: "string", description: "User ID to assign (optional)" },
      },
      required: ["deliverableId", "title"],
    },
  },
  {
    name: "update_subtask",
    description:
      "Update a subtask's title, dates, assignee, or status. Requires project membership or MANAGE_MILESTONES.",
    inputSchema: {
      type: "object",
      properties: {
        subtaskId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        startDate: { type: "string", description: "ISO date string, or null to clear" },
        dueDate: { type: "string", description: "ISO date string, or null to clear" },
        assigneeId: { type: "string", description: "User ID, or null to unassign" },
        status: {
          type: "string",
          enum: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"],
        },
      },
      required: ["subtaskId"],
    },
  },
  {
    name: "delete_subtask",
    description:
      "Delete a subtask. Requires MANAGE_MILESTONES or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        subtaskId: { type: "string" },
      },
      required: ["subtaskId"],
    },
  },
];

// Don't write more than once per this window — keeps multi-call sessions from hammering
// the DB while still letting `lastSeenAt` advance over time (R18.1).
const CONNECTION_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Record (or refresh) an MCP connection for the authenticated user. Best-effort: a write
 * failure must never 500 a tool call, so everything is wrapped in try/catch. Throttled so
 * we only bump `lastSeenAt` once per `CONNECTION_THROTTLE_MS`.
 */
async function recordMcpConnection(
  userId: string,
  type: McpConnectionType,
  clientId: string,
  label: string
): Promise<void> {
  try {
    const where = { userId_type_clientId: { userId, type, clientId } };
    const existing = await prisma.mcpConnection.findUnique({
      where,
      select: { lastSeenAt: true },
    });
    const now = new Date();
    if (existing) {
      if (now.getTime() - existing.lastSeenAt.getTime() < CONNECTION_THROTTLE_MS) return;
      await prisma.mcpConnection.update({ where, data: { lastSeenAt: now } });
    } else {
      await prisma.mcpConnection.create({
        data: { userId, type, clientId, label, lastSeenAt: now },
      });
    }
  } catch (e) {
    console.warn("[mcp] connection upsert failed:", (e as Error)?.message);
  }
}

async function authenticate(req: NextRequest): Promise<McpUser | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  // (1) Static personal token from /account — local clients (Claude Code, Cursor, Codex).
  if (!looksLikeJwt(token)) {
    const user = await prisma.user.findUnique({
      where: { mcpToken: token },
      select: { id: true, email: true, roleId: true, status: true },
    });
    if (user && user.status === "ACTIVE") {
      await recordMcpConnection(
        user.id,
        McpConnectionType.ACCESS_TOKEN,
        "personal",
        "Personal access token"
      );
      return { id: user.id, email: user.email, roleId: user.roleId };
    }
    return null;
  }

  // (2) Stytch-issued OAuth access token — ChatGPT / remote MCP hosts (R17.2).
  const result = await verifyOAuthAccessToken(token);
  if (!result) return null;
  await recordMcpConnection(
    result.id,
    McpConnectionType.OAUTH,
    result.oauthClientId ?? "oauth",
    result.oauthClientLabel ?? "OAuth client"
  );
  return { id: result.id, email: result.email, roleId: result.roleId };
}

async function getProjectMembership(userId: string, projectId: string) {
  return prisma.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: McpUser,
  permissions: Permission[]
): Promise<unknown> {
  switch (name) {
    // ── list_projects ────────────────────────────────────────────────────────
    case "list_projects": {
      if (permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
        const projects = await prisma.project.findMany({
          select: { id: true, name: true, status: true, semester: true },
        });
        return { projects };
      }
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId: user.id },
        include: { project: { select: { id: true, name: true, status: true, semester: true } } },
      });
      return { projects: assignments.map((a) => a.project) };
    }

    // ── get_project_detail ───────────────────────────────────────────────────
    case "get_project_detail": {
      const pid = args.projectId as string;
      const membership = await getProjectMembership(user.id, pid);
      if (!membership && !permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
        return { error: "No access to this project" };
      }
      const [project, deliverables, actionItems] = await Promise.all([
        prisma.project.findUnique({
          where: { id: pid },
          select: { id: true, name: true, semester: true, status: true, startDate: true, endDate: true, description: true },
        }),
        prisma.deliverable.findMany({
          where: { projectId: pid },
          select: {
            id: true,
            title: true,
            status: true,
            targetDate: true,
            group: true,
            backlog: true,
            subtasks: {
              select: { id: true, title: true, status: true, dueDate: true, assigneeId: true },
              orderBy: { orderIndex: "asc" },
            },
          },
          orderBy: { orderIndex: "asc" },
        }),
        prisma.actionItem.findMany({
          where: { projectId: pid, status: "OPEN" },
          select: { id: true, description: true, deadline: true },
          take: 20,
        }),
      ]);
      return { project, deliverables, actionItems };
    }

    // ── list_members ─────────────────────────────────────────────────────────
    case "list_members": {
      const statusFilter = (args.status as string | undefined) ?? "ACTIVE";
      const pid = args.projectId as string | undefined;

      if (pid) {
        const callerMembership = await getProjectMembership(user.id, pid);
        if (!callerMembership && !permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
          return { error: "No access to this project" };
        }
        const assignments = await prisma.projectAssignment.findMany({
          where: {
            projectId: pid,
            ...(args.projectRole ? { role: args.projectRole as "LEAD" | "SUBLEAD" | "MEMBER" } : {}),
            user: {
              status: statusFilter as "ACTIVE" | "PENDING" | "SUSPENDED",
              ...(args.roleName ? { role: { name: args.roleName as string } } : {}),
            },
          },
          include: { user: { include: { role: { select: { name: true } } } } },
          orderBy: { user: { name: "asc" } },
        });
        return {
          members: assignments.map((a) => ({
            id: a.user.id,
            name: a.user.name,
            email: a.user.email,
            status: a.user.status,
            roleName: a.user.role?.name ?? null,
            projectRole: a.role,
          })),
        };
      }

      if (!permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
        return { error: "VIEW_ALL_PROJECTS permission required to query all members without a projectId" };
      }
      const users = await prisma.user.findMany({
        where: {
          status: statusFilter as "ACTIVE" | "PENDING" | "SUSPENDED",
          ...(args.roleName ? { role: { name: args.roleName as string } } : {}),
        },
        include: { role: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: 200,
      });
      return {
        members: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          status: u.status,
          roleName: u.role?.name ?? null,
        })),
      };
    }

    // ── list_action_items ────────────────────────────────────────────────────
    case "list_action_items": {
      const pid = args.projectId as string | undefined;
      const hasViewAll = permissions.includes(Permission.VIEW_ALL_PROJECTS);

      const items = await prisma.actionItem.findMany({
        where: {
          ...(pid ? { projectId: pid } : !hasViewAll
            ? { project: { assignments: { some: { userId: user.id } } } }
            : {}),
          ...(args.status ? { status: args.status as ActionItemStatus } : {}),
          ...(args.assignedToMe ? { ownerId: user.id } : {}),
        },
        include: {
          project: { select: { id: true, name: true } },
          owner: { select: { name: true } },
        },
        orderBy: [{ deadline: { sort: "asc", nulls: "last" } }],
        take: 50,
      });
      return {
        actionItems: items.map((i) => ({
          id: i.id,
          description: i.description,
          status: i.status,
          deadline: i.deadline,
          projectId: i.project.id,
          projectName: i.project.name,
          ownerName: i.owner?.name ?? null,
        })),
      };
    }

    // ── get_my_subtasks ──────────────────────────────────────────────────────
    case "get_my_subtasks": {
      const subtasks = await prisma.subtask.findMany({
        where: {
          assigneeId: user.id,
          ...(args.status ? { status: args.status as TimelineStatus } : {}),
        },
        include: {
          deliverable: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 50,
      });
      return {
        subtasks: subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          dueDate: s.dueDate,
          deliverableId: s.deliverable.id,
          deliverableTitle: s.deliverable.title,
          projectId: s.deliverable.project.id,
          projectName: s.deliverable.project.name,
        })),
      };
    }

    // ── create_project ───────────────────────────────────────────────────────
    case "create_project": {
      if (!permissions.includes(Permission.MANAGE_PROJECTS)) {
        return { error: "Requires MANAGE_PROJECTS permission" };
      }
      const name = (args.name as string | undefined)?.trim();
      const semester = (args.semester as string | undefined)?.trim();
      if (!name || !semester) return { error: "name and semester are required" };

      const startDate = args.startDate ? new Date(args.startDate as string) : null;
      const endDate = args.endDate ? new Date(args.endDate as string) : null;
      if (startDate && endDate && endDate < startDate) {
        return { error: "endDate must be after startDate" };
      }

      const project = await prisma.project.create({
        data: {
          name,
          semester,
          description: (args.description as string | undefined) ?? null,
          startDate,
          endDate,
        },
        select: { id: true, name: true, semester: true },
      });
      return { created: project };
    }

    // ── update_project ───────────────────────────────────────────────────────
    case "update_project": {
      if (!permissions.includes(Permission.MANAGE_PROJECTS)) {
        return { error: "Requires MANAGE_PROJECTS permission" };
      }
      const pid = args.projectId as string;
      const updateFields: Record<string, unknown> = {};
      if (args.name !== undefined) updateFields.name = (args.name as string).trim();
      if (args.semester !== undefined) updateFields.semester = (args.semester as string).trim();
      if (args.description !== undefined) updateFields.description = args.description as string;
      if (args.correctiveActionPlan !== undefined) updateFields.correctiveActionPlan = args.correctiveActionPlan as string;
      if ("startDate" in args) updateFields.startDate = args.startDate ? new Date(args.startDate as string) : null;
      if ("endDate" in args) updateFields.endDate = args.endDate ? new Date(args.endDate as string) : null;

      if (Object.keys(updateFields).length === 0) return { error: "No fields to update" };

      if (updateFields.startDate && updateFields.endDate && (updateFields.endDate as Date) < (updateFields.startDate as Date)) {
        return { error: "endDate must be after startDate" };
      }

      const updated = await prisma.project.update({
        where: { id: pid },
        data: updateFields,
        select: { id: true, name: true, semester: true, startDate: true, endDate: true },
      });
      return { updated };
    }

    // ── create_action_item ───────────────────────────────────────────────────
    case "create_action_item": {
      const pid = args.projectId as string;
      const membership = await getProjectMembership(user.id, pid);
      const canCreate =
        permissions.includes(Permission.ASSIGN_ACTION_ITEMS) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canCreate) return { error: "Insufficient permissions to create action items on this project" };
      // Owner defaults to the caller, but a lead/eboard can delegate to any user by id
      // (mirrors the owner dropdown in the web action-item form); "" clears the owner.
      const ownerId = "ownerId" in args ? ((args.ownerId as string) || null) : user.id;
      const item = await prisma.actionItem.create({
        data: {
          projectId: pid,
          description: args.description as string,
          deadline: args.deadline ? new Date(args.deadline as string) : null,
          ownerId,
        },
        select: { id: true, description: true, ownerId: true },
      });
      return { created: item };
    }

    // ── update_action_item ───────────────────────────────────────────────────
    case "update_action_item": {
      const aid = args.actionItemId as string;
      const actionItem = await prisma.actionItem.findUnique({
        where: { id: aid },
        select: { projectId: true },
      });
      if (!actionItem) return { error: "Action item not found" };
      const membership = await getProjectMembership(user.id, actionItem.projectId);
      const canUpdate =
        permissions.includes(Permission.CLOSE_ACTION_ITEMS) ||
        permissions.includes(Permission.ASSIGN_ACTION_ITEMS) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canUpdate) return { error: "Insufficient permissions to update this action item" };

      const newStatus = args.status as ActionItemStatus | undefined;
      const updated = await prisma.actionItem.update({
        where: { id: aid },
        data: {
          ...(newStatus !== undefined ? {
            status: newStatus,
            completedAt: newStatus === "DONE" ? new Date() : null,
          } : {}),
          ...("deadline" in args ? { deadline: args.deadline ? new Date(args.deadline as string) : null } : {}),
          ...(args.description !== undefined ? { description: args.description as string } : {}),
          ...("ownerId" in args ? { ownerId: (args.ownerId as string) || null } : {}),
        },
        select: { id: true, status: true, deadline: true, description: true, ownerId: true },
      });
      return { updated };
    }

    // ── delete_action_item ───────────────────────────────────────────────────
    case "delete_action_item": {
      const aid = args.action_item_id as string;
      const actionItem = await prisma.actionItem.findUnique({
        where: { id: aid },
        select: { projectId: true },
      });
      if (!actionItem) return { error: "Action item not found" };
      const membership = await getProjectMembership(user.id, actionItem.projectId);
      const canDelete =
        permissions.includes(Permission.CLOSE_ACTION_ITEMS) ||
        permissions.includes(Permission.ASSIGN_ACTION_ITEMS) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canDelete) return { error: "Insufficient permissions to delete this action item" };
      await prisma.actionItem.delete({ where: { id: aid } });
      return { deleted: true, id: aid };
    }

    // ── create_status_update ─────────────────────────────────────────────────
    case "create_status_update": {
      const pid = args.projectId as string;
      const membership = await getProjectMembership(user.id, pid);
      const canPost =
        permissions.includes(Permission.POST_MEETING_TRACKING) ||
        permissions.includes(Permission.SUBMIT_STATUS_UPDATES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canPost) return { error: "Insufficient permissions to submit status updates" };

      // Standings are submitted against a pending lead meeting (mirrors the web submit
      // flow) so the meeting date/late flag are derived and the project's "Submit Project
      // Standing" affordance actually clears — an unlinked update leaves it stuck pending.
      const pending = await getPendingLeadMeetings(pid);
      if (pending.length === 0) {
        return { error: "No lead meeting is currently open for a project standing submission on this project" };
      }
      const targetMeetingId = (args.calendarEventId as string | undefined)?.trim() || null;
      const target = targetMeetingId
        ? pending.find((p) => p.meeting.id === targetMeetingId)
        : pending[0];
      if (!target) {
        return {
          error:
            "That lead meeting is not open for submission for this project. Omit calendarEventId to submit for the soonest pending meeting.",
        };
      }

      const needsHelp = typeof args.needsHelp === "boolean" ? (args.needsHelp as boolean) : false;
      const update = await prisma.statusUpdate.create({
        data: {
          projectId: pid,
          submittedById: user.id,
          calendarEventId: target.meeting.id,
          meetingDate: target.meeting.startsAt,
          plannedWork: args.plannedWork as string,
          actualProgress: args.actualProgress as string,
          blockers: args.blockers as string,
          nextWeekGoals: args.nextWeekGoals as string,
          needsHelp,
          helpNeeded: needsHelp ? ((args.helpNeeded as string | undefined)?.trim() || null) : null,
          isLate: target.isLate,
        },
        select: { id: true, meetingDate: true, isLate: true },
      });
      return { created: update };
    }

    // ── list_status_updates ──────────────────────────────────────────────────
    case "list_status_updates": {
      const pid = args.projectId as string | undefined;
      const hasViewAll = permissions.includes(Permission.VIEW_ALL_PROJECTS);
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);

      if (pid) {
        const membership = await getProjectMembership(user.id, pid);
        if (!membership && !hasViewAll) return { error: "No access to this project" };
      }

      const updates = await prisma.statusUpdate.findMany({
        where: {
          ...(pid ? { projectId: pid } : !hasViewAll
            ? { project: { assignments: { some: { userId: user.id } } } }
            : {}),
        },
        include: {
          project: { select: { id: true, name: true } },
          submittedBy: { select: { name: true } },
        },
        orderBy: { meetingDate: "desc" },
        take: limit,
      });
      return {
        statusUpdates: updates.map((u) => ({
          id: u.id,
          projectId: u.project.id,
          projectName: u.project.name,
          meetingDate: u.meetingDate,
          plannedWork: u.plannedWork,
          actualProgress: u.actualProgress,
          blockers: u.blockers,
          nextWeekGoals: u.nextWeekGoals,
          needsHelp: u.needsHelp,
          helpNeeded: u.helpNeeded,
          isLate: u.isLate,
          submittedByName: u.submittedBy?.name ?? null,
        })),
      };
    }

    // ── list_meeting_records ─────────────────────────────────────────────────
    case "list_meeting_records": {
      const pid = args.projectId as string;
      const membership = await getProjectMembership(user.id, pid);
      if (!membership && !permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
        return { error: "No access to this project" };
      }
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
      const records = await prisma.meetingRecord.findMany({
        where: { projectId: pid },
        include: { recordedBy: { select: { name: true } } },
        orderBy: { meetingDate: "desc" },
        take: limit,
      });
      return {
        meetingRecords: records.map((r) => ({
          id: r.id,
          meetingDate: r.meetingDate,
          status: r.status,
          goalMet: r.goalMet,
          keyBlockers: r.keyBlockers,
          notes: r.notes,
          recordedByName: r.recordedBy?.name ?? null,
        })),
      };
    }

    // ── create_meeting_record ────────────────────────────────────────────────
    case "create_meeting_record": {
      if (!permissions.includes(Permission.POST_MEETING_TRACKING)) {
        return { error: "Requires POST_MEETING_TRACKING permission" };
      }
      const pid = args.projectId as string;
      const project = await prisma.project.findUnique({
        where: { id: pid },
        select: { id: true, statusOverride: true },
      });
      if (!project) return { error: "Project not found" };

      const status = args.status as ProjectStatus;
      const record = await prisma.meetingRecord.create({
        data: {
          projectId: pid,
          meetingDate: new Date(args.meetingDate as string),
          status,
          goalMet: typeof args.goalMet === "boolean" ? (args.goalMet as boolean) : null,
          keyBlockers: (args.keyBlockers as string | undefined)?.trim() || null,
          notes: (args.notes as string | undefined)?.trim() || null,
          recordedById: user.id,
        },
        select: { id: true, meetingDate: true, status: true },
      });

      // Mirror the createMeetingRecord server action's side effects.
      if (!project.statusOverride) {
        await prisma.project.update({ where: { id: pid }, data: { status } });
      }
      await carryOverActionItems(pid);
      await runRedFlagDetection(pid);
      return { created: record };
    }

    // ── delete_meeting_record ────────────────────────────────────────────────
    case "delete_meeting_record": {
      if (!permissions.includes(Permission.MANAGE_MEETING_RECORDS)) {
        return { error: "Requires MANAGE_MEETING_RECORDS permission" };
      }
      const mid = args.meetingRecordId as string;
      const record = await prisma.meetingRecord.findUnique({
        where: { id: mid },
        select: { id: true, projectId: true },
      });
      if (!record) return { error: "Meeting record not found" };
      await prisma.meetingRecord.delete({ where: { id: mid } });
      await runRedFlagDetection(record.projectId);
      return { deleted: { id: mid } };
    }

    // ── create_deliverable ───────────────────────────────────────────────────
    case "create_deliverable": {
      const pid = args.projectId as string;
      const membership = await getProjectMembership(user.id, pid);
      const canCreate =
        permissions.includes(Permission.MANAGE_MILESTONES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canCreate) return { error: "Insufficient permissions to create deliverables" };

      const cTarget = new Date(args.targetDate as string);
      const cStart = args.startDate ? new Date(args.startDate as string) : null;
      if (cStart && cStart > cTarget) return { error: "startDate must not be after targetDate" };

      const count = await prisma.deliverable.count({ where: { projectId: pid } });
      const deliverable = await prisma.deliverable.create({
        data: {
          projectId: pid,
          title: args.title as string,
          targetDate: cTarget,
          description: (args.description as string | undefined) ?? null,
          startDate: cStart,
          group: (args.group as string | undefined) ?? null,
          orderIndex: count,
          ...(typeof args.priority === "string" && args.priority in Priority
            ? { priority: args.priority as Priority }
            : {}),
        },
        select: { id: true, title: true, status: true, targetDate: true, group: true, priority: true },
      });
      return { created: deliverable };
    }

    // ── update_deliverable ───────────────────────────────────────────────────
    case "update_deliverable": {
      const did = args.deliverableId as string;
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: did },
        select: { projectId: true, startDate: true, targetDate: true },
      });
      if (!deliverable) return { error: "Deliverable not found" };
      const membership = await getProjectMembership(user.id, deliverable.projectId);
      const canUpdate =
        permissions.includes(Permission.MANAGE_MILESTONES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canUpdate) return { error: "Insufficient permissions to update this deliverable" };

      // Validate the effective (post-update) date window so a partial update can't leave the
      // deliverable inverted (start after target) — mirrors the web updateDeliverable check.
      const effTarget =
        args.targetDate !== undefined ? new Date(args.targetDate as string) : deliverable.targetDate;
      const effStart =
        "startDate" in args
          ? (args.startDate ? new Date(args.startDate as string) : null)
          : deliverable.startDate;
      if (effStart && effTarget && effStart > effTarget) {
        return { error: "startDate must not be after targetDate" };
      }

      const newStatus = args.status as TimelineStatus | undefined;
      const isComplete = newStatus === TimelineStatus.COMPLETE;

      const updated = await prisma.deliverable.update({
        where: { id: did },
        data: {
          ...(args.title !== undefined ? { title: args.title as string } : {}),
          ...(args.targetDate !== undefined ? { targetDate: new Date(args.targetDate as string) } : {}),
          ...("startDate" in args ? { startDate: args.startDate ? new Date(args.startDate as string) : null } : {}),
          ...("description" in args ? { description: (args.description as string | undefined) ?? null } : {}),
          ...(newStatus !== undefined ? {
            status: newStatus,
            completed: isComplete,
            completedDate: isComplete ? new Date() : null,
          } : {}),
          ...("group" in args ? { group: (args.group as string | undefined) ?? null } : {}),
          ...(typeof args.priority === "string" && args.priority in Priority
            ? { priority: args.priority as Priority }
            : {}),
          ...(typeof args.backlog === "boolean" ? { backlog: args.backlog } : {}),
        },
        select: { id: true, title: true, status: true, targetDate: true, group: true, priority: true, backlog: true },
      });
      return { updated };
    }

    // ── delete_deliverable ───────────────────────────────────────────────────
    case "delete_deliverable": {
      const did = args.deliverableId as string;
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: did },
        select: { id: true, title: true, projectId: true },
      });
      if (!deliverable) return { error: "Deliverable not found" };
      const membership = await getProjectMembership(user.id, deliverable.projectId);
      const canDelete =
        permissions.includes(Permission.MANAGE_MILESTONES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canDelete) {
        return { error: "MANAGE_MILESTONES or project LEAD/SUBLEAD required to delete deliverables" };
      }
      await prisma.deliverable.delete({ where: { id: did } });
      return { deleted: { id: did, title: deliverable.title } };
    }

    // ── list_calendar_events ─────────────────────────────────────────────────
    case "list_calendar_events": {
      const semester = args.semester as string | undefined;
      const from = args.from ? new Date(args.from as string) : undefined;
      const to = args.to ? new Date(args.to as string) : undefined;
      const type = args.type as CalendarEventType | undefined;

      // Members without VIEW_LEAD_MEETINGS never see lead/eboard meetings — if they
      // explicitly ask for a restricted type, return nothing rather than leak.
      const canSeeRestricted = permissions.includes(Permission.VIEW_LEAD_MEETINGS);
      if (!canSeeRestricted && type && RESTRICTED_EVENT_TYPES.includes(type)) {
        return { events: [] };
      }

      const events = await prisma.calendarEvent.findMany({
        where: {
          ...(semester ? { semester } : {}),
          ...(from || to ? { startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
          ...(type ? { type } : canSeeRestricted ? {} : { type: { notIn: RESTRICTED_EVENT_TYPES } }),
        },
        include: { project: { select: { name: true } } },
        orderBy: { startsAt: "asc" },
        take: 100,
      });
      return {
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          location: e.location,
          projectId: e.projectId,
          project: e.project ? { name: e.project.name } : null,
        })),
      };
    }

    // ── create_calendar_event ────────────────────────────────────────────────
    case "create_calendar_event": {
      if (!permissions.includes(Permission.MANAGE_CALENDAR)) {
        return { error: "Requires MANAGE_CALENDAR permission" };
      }
      const title = (args.title as string | undefined)?.trim();
      const semester = (args.semester as string | undefined)?.trim();
      const startsAtRaw = args.startsAt as string | undefined;
      if (!title || !semester || !startsAtRaw) return { error: "title, semester, and startsAt are required" };

      const startsAt = new Date(startsAtRaw);
      const endsAt = args.endsAt ? new Date(args.endsAt as string) : null;
      if (endsAt && endsAt < startsAt) return { error: "endsAt must be after startsAt" };

      const eventType = (args.type as CalendarEventType | undefined) ?? CalendarEventType.PROJECT_MEETING;
      // Lead/eboard meetings govern projects by `semesters` (see lead-meeting.ts);
      // default it to [semester] so an MCP-created meeting actually takes effect.
      const semesters = Array.isArray(args.semesters)
        ? (args.semesters as string[])
        : RESTRICTED_EVENT_TYPES.includes(eventType)
          ? [semester]
          : [];

      const event = await prisma.calendarEvent.create({
        data: {
          title,
          semester,
          type: eventType,
          semesters,
          startsAt,
          endsAt,
          allDay: (args.allDay as boolean | undefined) ?? false,
          location: (args.location as string | undefined) ?? null,
          description: (args.description as string | undefined) ?? null,
          projectId: (args.projectId as string | undefined) ?? null,
        },
        select: { id: true, title: true, startsAt: true },
      });
      return { created: event };
    }

    // ── update_calendar_event ────────────────────────────────────────────────
    case "update_calendar_event": {
      if (!permissions.includes(Permission.MANAGE_CALENDAR)) {
        return { error: "Requires MANAGE_CALENDAR permission" };
      }
      const eid = args.eventId as string;
      const updateData: Record<string, unknown> = {};
      if (args.title !== undefined) updateData.title = (args.title as string).trim();
      if (args.semester !== undefined) updateData.semester = (args.semester as string).trim();
      if (args.startsAt !== undefined) updateData.startsAt = new Date(args.startsAt as string);
      if (args.type !== undefined) updateData.type = args.type as CalendarEventType;
      if (Array.isArray(args.semesters)) updateData.semesters = args.semesters as string[];
      if ("endsAt" in args) updateData.endsAt = args.endsAt ? new Date(args.endsAt as string) : null;
      if (args.allDay !== undefined) updateData.allDay = args.allDay as boolean;
      if (args.location !== undefined) updateData.location = args.location as string | null;
      if (args.description !== undefined) updateData.description = args.description as string | null;
      if ("projectId" in args) updateData.projectId = (args.projectId as string | null) ?? null;

      if (Object.keys(updateData).length === 0) return { error: "No fields to update" };

      const updated = await prisma.calendarEvent.update({
        where: { id: eid },
        data: updateData,
        select: { id: true, title: true, startsAt: true },
      });
      return { updated };
    }

    // ── delete_calendar_event ────────────────────────────────────────────────
    case "delete_calendar_event": {
      if (!permissions.includes(Permission.MANAGE_CALENDAR)) {
        return { error: "Requires MANAGE_CALENDAR permission" };
      }
      const eid = args.eventId as string;
      const existing = await prisma.calendarEvent.findUnique({ where: { id: eid }, select: { id: true, title: true } });
      if (!existing) return { error: "Calendar event not found" };
      await prisma.calendarEvent.delete({ where: { id: eid } });
      return { deleted: { id: eid, title: existing.title } };
    }

    // ── create_subtask ───────────────────────────────────────────────────────
    case "create_subtask": {
      const delId = args.deliverableId as string;
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: delId },
        select: { projectId: true },
      });
      if (!deliverable) return { error: "Deliverable not found" };
      const membership = await getProjectMembership(user.id, deliverable.projectId);
      if (!membership && !permissions.includes(Permission.MANAGE_MILESTONES)) {
        return { error: "Project membership or MANAGE_MILESTONES required to create subtasks" };
      }

      const count = await prisma.subtask.count({ where: { deliverableId: delId } });
      const subtask = await prisma.subtask.create({
        data: {
          deliverableId: delId,
          title: args.title as string,
          description: (args.description as string | undefined) ?? null,
          startDate: args.startDate ? new Date(args.startDate as string) : null,
          dueDate: args.dueDate ? new Date(args.dueDate as string) : null,
          assigneeId: (args.assigneeId as string | undefined) ?? null,
          orderIndex: count,
        },
        select: { id: true, title: true, status: true, startDate: true, dueDate: true },
      });
      return { created: subtask };
    }

    // ── update_subtask ───────────────────────────────────────────────────────
    case "update_subtask": {
      const sid = args.subtaskId as string;
      const subtask = await prisma.subtask.findUnique({
        where: { id: sid },
        include: { deliverable: { select: { projectId: true } } },
      });
      if (!subtask) return { error: "Subtask not found" };
      const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
      if (!membership && !permissions.includes(Permission.MANAGE_MILESTONES)) {
        return { error: "Project membership or MANAGE_MILESTONES required to update subtasks" };
      }

      const newStatus = args.status as TimelineStatus | undefined;
      const updated = await prisma.subtask.update({
        where: { id: sid },
        data: {
          ...(args.title !== undefined ? { title: args.title as string } : {}),
          ...("description" in args ? { description: (args.description as string | undefined) ?? null } : {}),
          ...("startDate" in args ? { startDate: args.startDate ? new Date(args.startDate as string) : null } : {}),
          ...("dueDate" in args ? { dueDate: args.dueDate ? new Date(args.dueDate as string) : null } : {}),
          ...("assigneeId" in args ? { assigneeId: (args.assigneeId as string | undefined) ?? null } : {}),
          ...(newStatus !== undefined ? {
            status: newStatus,
            completedAt: newStatus === TimelineStatus.COMPLETE ? new Date() : null,
          } : {}),
        },
        select: { id: true, title: true, status: true, startDate: true, dueDate: true, assigneeId: true },
      });
      return { updated };
    }

    // ── delete_subtask ───────────────────────────────────────────────────────
    case "delete_subtask": {
      const sid = args.subtaskId as string;
      const subtask = await prisma.subtask.findUnique({
        where: { id: sid },
        include: { deliverable: { select: { projectId: true } } },
      });
      if (!subtask) return { error: "Subtask not found" };
      const membership = await getProjectMembership(user.id, subtask.deliverable.projectId);
      const canDelete =
        permissions.includes(Permission.MANAGE_MILESTONES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canDelete) return { error: "MANAGE_MILESTONES or project LEAD/SUBLEAD required to delete subtasks" };
      await prisma.subtask.delete({ where: { id: sid } });
      return { deleted: { id: sid, title: subtask.title } };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    // RFC 9728 discovery: point OAuth clients (ChatGPT) at the protected-resource metadata.
    const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
    return Response.json(
      { error: "Unauthorized — provide a valid Bearer token" },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }

  let body: { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  const { id = null, method, params = {} } = body;

  const ok = (result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) =>
    Response.json({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "SEED Tracker", version: "2.4.0" },
      });

    case "ping":
      return ok({});

    case "notifications/initialized":
      return new Response(null, { status: 204 });

    case "tools/list":
      return ok({ tools: TOOLS });

    case "tools/call": {
      const { name, arguments: args = {} } = params as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      if (!name) return err(-32602, "Missing tool name");
      const permissions = await getUserPermissions(user.roleId);
      const result = await executeTool(name, args, user, permissions);
      return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    }

    default:
      return err(-32601, `Method not found: ${method}`);
  }
}
