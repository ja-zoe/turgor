import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";

type McpUser = { id: string; email: string; roleId: string | null };

const TOOLS = [
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
    name: "create_action_item",
    description: "Create an action item on a project. Requires LEAD, SUBLEAD, or ASSIGN_ACTION_ITEMS permission.",
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
      required: ["projectId", "meetingDate", "plannedWork", "actualProgress", "blockers", "nextWeekGoals"],
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

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: McpUser,
  permissions: Permission[]
): Promise<unknown> {
  switch (name) {
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

    case "get_project_detail": {
      const pid = args.projectId as string;
      const membership = await prisma.projectAssignment.findUnique({
        where: { projectId_userId: { projectId: pid, userId: user.id } },
      });
      if (!membership && !permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
        return { error: "No access to this project" };
      }
      const [deliverables, actionItems] = await Promise.all([
        prisma.deliverable.findMany({
          where: { projectId: pid },
          select: { id: true, title: true, status: true, targetDate: true },
          orderBy: { orderIndex: "asc" },
        }),
        prisma.actionItem.findMany({
          where: { projectId: pid, status: "OPEN" },
          select: { id: true, description: true, deadline: true },
          take: 20,
        }),
      ]);
      return { deliverables, actionItems };
    }

    case "create_action_item": {
      const pid = args.projectId as string;
      const membership = await prisma.projectAssignment.findUnique({
        where: { projectId_userId: { projectId: pid, userId: user.id } },
      });
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

    case "create_status_update": {
      const pid = args.projectId as string;
      const membership = await prisma.projectAssignment.findUnique({
        where: { projectId_userId: { projectId: pid, userId: user.id } },
      });
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
        serverInfo: { name: "SEED Tracker", version: "1.0.0" },
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
