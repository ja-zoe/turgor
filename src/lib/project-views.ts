import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  getUserPermissions,
  getProjectMembership,
  type SessionUser,
} from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { getDisplayName } from "@/lib/utils";

/**
 * Shared access + shaping for the project-scoped pages (R30.1/R30.2). The guard
 * and permission derivations mirror `/projects/[id]/page.tsx` exactly — one
 * source so the dedicated deliverables/action-items pages can never drift from
 * the project page's gates (CONTEXT.md cross-surface rule).
 */

const MEMBER_USER_SELECT = {
  id: true,
  firstName: true,
  nickname: true,
  name: true,
  email: true,
} as const;

export type ProjectAccess = {
  user: SessionUser;
  permissions: Permission[];
  membership: { role: "LEAD" | "SUBLEAD" | "MEMBER" } | null;
  isLeadHere: boolean;
  canManage: boolean;
  canManageMilestones: boolean;
  canCreateActionItem: boolean;
  canCloseActionItemsHere: boolean;
  project: {
    id: string;
    name: string;
    semester: string;
    archivedAt: Date | null;
    assignments: {
      userId: string;
      role: "LEAD" | "SUBLEAD" | "MEMBER";
      user: { id: string; firstName: string | null; nickname: string | null; name: string | null; email: string };
    }[];
  };
};

export async function getProjectAccess(projectId: string): Promise<ProjectAccess> {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const canManage = permissions.includes(Permission.MANAGE_PROJECTS);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      semester: true,
      archivedAt: true,
      assignments: { select: { userId: true, role: true, user: { select: MEMBER_USER_SELECT } } },
    },
  });
  if (!project) notFound();

  const membership = await getProjectMembership(user.id, projectId);
  const canViewAll = permissions.includes(Permission.VIEW_ALL_PROJECTS) || canManage;
  if (!membership && !canViewAll) notFound();

  const isLeadHere = membership?.role === "LEAD" || membership?.role === "SUBLEAD";
  return {
    user,
    permissions,
    membership,
    isLeadHere,
    canManage,
    canManageMilestones: permissions.includes(Permission.MANAGE_MILESTONES),
    canCreateActionItem:
      permissions.includes(Permission.ASSIGN_ACTION_ITEMS) || isLeadHere,
    canCloseActionItemsHere:
      permissions.includes(Permission.CLOSE_ACTION_ITEMS) || isLeadHere,
    project,
  };
}

/**
 * Projects the viewer may switch to, scoped exactly like `/projects`:
 * VIEW_ALL_PROJECTS or MANAGE_PROJECTS sees everything, everyone else their
 * assignments. Archived projects stay listed (lookup surface) but flagged.
 */
export async function listSwitcherProjects(access: ProjectAccess) {
  const canViewAll =
    access.permissions.includes(Permission.VIEW_ALL_PROJECTS) || access.canManage;
  const rows = await prisma.project.findMany({
    where: canViewAll ? {} : { assignments: { some: { userId: access.user.id } } },
    select: { id: true, name: true, semester: true, archivedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    semester: p.semester,
    archived: p.archivedAt !== null,
  }));
}

type ActionItemRow = {
  id: string;
  description: string;
  ownerId: string | null;
  owner: { firstName: string | null; nickname: string | null; name: string | null; email: string } | null;
  deadline: Date | null;
  status: string;
  carriedOver: boolean;
};

/** Shape action-item rows for ActionItemsSection — shared with the project page. */
export function toActionItemRows(items: ActionItemRow[]) {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    ownerId: item.ownerId,
    ownerName: item.owner ? getDisplayName(item.owner) : null,
    deadline: item.deadline?.toISOString() ?? null,
    status: item.status as "OPEN" | "DONE",
    carriedOver: item.carriedOver,
  }));
}

type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  group: string | null;
  orderIndex: number;
  targetDate: Date;
  startDate: Date | null;
  completed: boolean;
  backlog: boolean;
  subtasks: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    assignee: { id: string; firstName: string | null; nickname: string | null; name: string | null; email: string } | null;
    startDate: Date | null;
    dueDate: Date | null;
  }[];
};

/** Shape deliverable rows for SortableDeliverables — shared with the project page. */
export function toSortableDeliverables(deliverables: DeliverableRow[]) {
  return deliverables.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    status: d.status as "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE",
    priority: d.priority as "LOW" | "MEDIUM" | "HIGH",
    group: d.group,
    orderIndex: d.orderIndex,
    targetDate: d.targetDate.toISOString(),
    startDate: d.startDate?.toISOString() ?? null,
    completed: d.completed,
    backlog: d.backlog,
    subtasks: d.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? null,
      status: s.status as "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE",
      assignee: s.assignee,
      startDate: s.startDate?.toISOString() ?? null,
      dueDate: s.dueDate?.toISOString() ?? null,
    })),
  }));
}
