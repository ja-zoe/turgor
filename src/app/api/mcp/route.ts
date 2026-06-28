import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Permission, TimelineStatus, ActionItemStatus, CalendarEventType } from "@/generated/prisma";

type McpUser = { id: string; email: string; roleId: string | null };

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
      },
      required: ["projectId", "description"],
    },
  },
  {
    name: "update_action_item",
    description:
      "Close, reopen, or edit an action item. Requires CLOSE_ACTION_ITEMS, ASSIGN_ACTION_ITEMS, or project LEAD/SUBLEAD.",
    inputSchema: {
      type: "object",
      properties: {
        actionItemId: { type: "string" },
        status: { type: "string", enum: ["OPEN", "DONE"] },
        deadline: { type: "string", description: "ISO date string, or null to clear" },
        description: { type: "string" },
      },
      required: ["actionItemId"],
    },
  },
  // ── Status updates ────────────────────────────────────────────────────────
  {
    name: "create_status_update",
    description: "Submit a weekly status update for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        meetingDate: { type: "string", description: "ISO date string" },
        plannedWork: { type: "string" },
        actualProgress: { type: "string" },
        blockers: { type: "string", description: "Describe blockers, or 'None'" },
        nextWeekGoals: { type: "string" },
      },
      required: [
        "projectId",
        "meetingDate",
        "plannedWork",
        "actualProgress",
        "blockers",
        "nextWeekGoals",
      ],
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
      },
      required: ["projectId", "title", "targetDate"],
    },
  },
  {
    name: "update_deliverable",
    description:
      "Update a deliverable's title, dates, status, or group. Requires MANAGE_MILESTONES or project LEAD/SUBLEAD.",
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
      },
      required: ["deliverableId"],
    },
  },
  {
    name: "delete_deliverable",
    description:
      "Delete a deliverable and all its subtasks. Requires MANAGE_MILESTONES.",
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
    description: "List calendar events, optionally filtered by semester, date range, or type. Read-only, available to all active users.",
    inputSchema: {
      type: "object",
      properties: {
        semester: { type: "string", description: "Filter by semester (e.g. 'Fall 2026')" },
        from: { type: "string", description: "ISO date — only events on/after this date" },
        to: { type: "string", description: "ISO date — only events on/before this date" },
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT"] },
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
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT"], description: "Default: PROJECT_MEETING" },
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
        type: { type: "string", enum: ["PROJECT_MEETING", "NON_PROJECT_EVENT"] },
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

async function authenticate(req: NextRequest): Promise<McpUser | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const user = await prisma.user.findUnique({
    where: { mcpToken: token },
    select: { id: true, email: true, roleId: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, email: user.email, roleId: user.roleId };
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
      const item = await prisma.actionItem.create({
        data: {
          projectId: pid,
          description: args.description as string,
          deadline: args.deadline ? new Date(args.deadline as string) : null,
          ownerId: user.id,
        },
        select: { id: true, description: true },
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
        },
        select: { id: true, status: true, deadline: true, description: true },
      });
      return { updated };
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
      const update = await prisma.statusUpdate.create({
        data: {
          projectId: pid,
          submittedById: user.id,
          meetingDate: new Date(args.meetingDate as string),
          plannedWork: args.plannedWork as string,
          actualProgress: args.actualProgress as string,
          blockers: args.blockers as string,
          nextWeekGoals: args.nextWeekGoals as string,
          needsHelp: false,
        },
        select: { id: true },
      });
      return { created: update };
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

      const count = await prisma.deliverable.count({ where: { projectId: pid } });
      const deliverable = await prisma.deliverable.create({
        data: {
          projectId: pid,
          title: args.title as string,
          targetDate: new Date(args.targetDate as string),
          description: (args.description as string | undefined) ?? null,
          startDate: args.startDate ? new Date(args.startDate as string) : null,
          group: (args.group as string | undefined) ?? null,
          orderIndex: count,
        },
        select: { id: true, title: true, status: true, targetDate: true, group: true },
      });
      return { created: deliverable };
    }

    // ── update_deliverable ───────────────────────────────────────────────────
    case "update_deliverable": {
      const did = args.deliverableId as string;
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: did },
        select: { projectId: true },
      });
      if (!deliverable) return { error: "Deliverable not found" };
      const membership = await getProjectMembership(user.id, deliverable.projectId);
      const canUpdate =
        permissions.includes(Permission.MANAGE_MILESTONES) ||
        membership?.role === "LEAD" ||
        membership?.role === "SUBLEAD";
      if (!canUpdate) return { error: "Insufficient permissions to update this deliverable" };

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
        },
        select: { id: true, title: true, status: true, targetDate: true, group: true },
      });
      return { updated };
    }

    // ── delete_deliverable ───────────────────────────────────────────────────
    case "delete_deliverable": {
      if (!permissions.includes(Permission.MANAGE_MILESTONES)) {
        return { error: "MANAGE_MILESTONES permission required to delete deliverables" };
      }
      const did = args.deliverableId as string;
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: did },
        select: { id: true, title: true },
      });
      if (!deliverable) return { error: "Deliverable not found" };
      await prisma.deliverable.delete({ where: { id: did } });
      return { deleted: { id: did, title: deliverable.title } };
    }

    // ── list_calendar_events ─────────────────────────────────────────────────
    case "list_calendar_events": {
      const semester = args.semester as string | undefined;
      const from = args.from ? new Date(args.from as string) : undefined;
      const to = args.to ? new Date(args.to as string) : undefined;
      const type = args.type as CalendarEventType | undefined;

      const events = await prisma.calendarEvent.findMany({
        where: {
          ...(semester ? { semester } : {}),
          ...(from || to ? { startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
          ...(type ? { type } : {}),
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

      const event = await prisma.calendarEvent.create({
        data: {
          title,
          semester,
          type: (args.type as CalendarEventType | undefined) ?? CalendarEventType.PROJECT_MEETING,
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
          dueDate: args.dueDate ? new Date(args.dueDate as string) : null,
          assigneeId: (args.assigneeId as string | undefined) ?? null,
          orderIndex: count,
        },
        select: { id: true, title: true, status: true, dueDate: true },
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
          ...("dueDate" in args ? { dueDate: args.dueDate ? new Date(args.dueDate as string) : null } : {}),
          ...("assigneeId" in args ? { assigneeId: (args.assigneeId as string | undefined) ?? null } : {}),
          ...(newStatus !== undefined ? {
            status: newStatus,
            completedAt: newStatus === TimelineStatus.COMPLETE ? new Date() : null,
          } : {}),
        },
        select: { id: true, title: true, status: true, dueDate: true, assigneeId: true },
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
    return Response.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
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
        serverInfo: { name: "SEED Tracker", version: "2.2.0" },
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
