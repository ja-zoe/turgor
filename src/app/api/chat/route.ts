import { NextRequest } from "next/server";
import { streamText, tool, convertToModelMessages, isStepCount } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { resolveModel, AiProvider } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { provider, apiKey, model, messages } = body;

  if (!provider || !apiKey || !model) {
    return new Response("Missing provider, apiKey, or model", { status: 400 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? "";
  const permissions = await getUserPermissions(session.user.roleId ?? null);

  const aiModel = resolveModel(provider as AiProvider, apiKey as string, model as string);

  // Convert UI messages (from @ai-sdk/react useChat) to model messages
  const modelMessages = await convertToModelMessages(messages);

  const systemPrompt = `You are SEED Assistant, an AI helping ${userEmail} manage their SEED projects. You can take actions within their permission scope. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Be concise and action-oriented. When the user asks you to do something you have a tool for, do it directly rather than asking for confirmation unless the action is destructive.`;

  const result = streamText({
    model: aiModel,
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: isStepCount(5),
    tools: {
      listProjects: tool({
        description: "List all projects the current user is assigned to",
        inputSchema: z.object({}),
        execute: async () => {
          // Include all projects if PM
          if (permissions.includes(Permission.VIEW_ALL_PROJECTS)) {
            const all = await prisma.project.findMany({
              select: { id: true, name: true, status: true, semester: true },
            });
            return { projects: all };
          }
          const assignments = await prisma.projectAssignment.findMany({
            where: { userId },
            include: { project: { select: { id: true, name: true, status: true, semester: true } } },
          });
          return { projects: assignments.map((a: { project: unknown }) => a.project) };
        },
      }),

      getProjectDetail: tool({
        description: "Get deliverables and open action items for a project",
        inputSchema: z.object({ projectId: z.string() }),
        execute: async ({ projectId: pid }) => {
          const membership = await prisma.projectAssignment.findUnique({
            where: { projectId_userId: { projectId: pid, userId } },
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
        },
      }),

      createActionItem: tool({
        description: "Create an action item on a project",
        inputSchema: z.object({
          projectId: z.string(),
          description: z.string(),
          deadline: z.string().optional().describe("ISO date string e.g. 2026-07-15"),
        }),
        execute: async ({ projectId: pid, description, deadline }) => {
          const membership = await prisma.projectAssignment.findUnique({
            where: { projectId_userId: { projectId: pid, userId } },
          });
          const canAssign =
            permissions.includes(Permission.ASSIGN_ACTION_ITEMS) ||
            membership?.role === "LEAD" ||
            membership?.role === "SUBLEAD";
          if (!canAssign) return { error: "You don't have permission to assign action items" };

          const item = await prisma.actionItem.create({
            data: {
              projectId: pid,
              description,
              deadline: deadline ? new Date(deadline) : null,
              ownerId: userId,
            },
            select: { id: true, description: true },
          });
          return { created: item };
        },
      }),

      createStatusUpdate: tool({
        description: "Submit a status update for a project",
        inputSchema: z.object({
          projectId: z.string(),
          meetingDate: z.string().describe("ISO date string"),
          plannedWork: z.string(),
          actualProgress: z.string(),
          blockers: z.string().describe("Describe blockers, or 'None' if none"),
          nextWeekGoals: z.string(),
        }),
        execute: async ({ projectId: pid, meetingDate, plannedWork, actualProgress, blockers, nextWeekGoals }) => {
          const membership = await prisma.projectAssignment.findUnique({
            where: { projectId_userId: { projectId: pid, userId } },
          });
          const canPost =
            permissions.includes(Permission.POST_MEETING_TRACKING) ||
            permissions.includes(Permission.SUBMIT_STATUS_UPDATES) ||
            membership?.role === "LEAD" ||
            membership?.role === "SUBLEAD";
          if (!canPost) return { error: "You don't have permission to submit status updates" };

          const update = await prisma.statusUpdate.create({
            data: {
              projectId: pid,
              submittedById: userId,
              meetingDate: new Date(meetingDate),
              plannedWork,
              actualProgress,
              blockers,
              nextWeekGoals,
              needsHelp: false,
            },
            select: { id: true },
          });
          return { created: update };
        },
      }),
    },
  });

  // toUIMessageStreamResponse() is the v7 replacement for toDataStreamResponse()
  return result.toUIMessageStreamResponse();
}
