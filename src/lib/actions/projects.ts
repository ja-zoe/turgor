"use server";

import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requirePermission,
  getUserPermissions,
  getProjectMembership,
} from "@/lib/permissions";
import { parseDateInput } from "@/lib/date";
import { assertWithinLimit } from "@/lib/entitlements/limits";
import { forOrg } from "@/lib/tenant-db";
import { Permission, ProjectMemberRole, ProjectStatus } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Who may edit an existing project's editable fields (name, description, dates,
 * corrective action plan):
 *  - anyone with MANAGE_PROJECTS (PM) — any project;
 *  - a project LEAD/SUBLEAD who holds EDIT_OWN_PROJECT — their own project only.
 * This is what makes the "Edit own project" permission (and the corrective-action-plan
 * prompt on the BEHIND banner) actually reachable for leads.
 */
export async function canEditProject(
  userId: string,
  roleId: string | null,
  projectId: string
): Promise<boolean> {
  const perms = await getUserPermissions(roleId);
  if (perms.includes(Permission.MANAGE_PROJECTS)) return true;
  if (!perms.includes(Permission.EDIT_OWN_PROJECT)) return false;
  const membership = await getProjectMembership(userId, projectId);
  return membership?.role === "LEAD" || membership?.role === "SUBLEAD";
}

export async function createProject(formData: FormData) {
  const user = await requirePermission(Permission.MANAGE_PROJECTS);

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const semester = (formData.get("semester") as string).trim();
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;

  if (!name || !semester) throw new Error("Name and semester are required");

  const startDate = parseDateInput(startDateRaw);
  const endDate = parseDateInput(endDateRaw);

  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be after start date");
  }

  // Plan quota (set 37): community = unlimited (no-op); a cloud plan caps active projects.
  const activeCount = await forOrg(user.orgId).project.count({ where: { archivedAt: null } });
  await assertWithinLimit(user.orgId, "MAX_PROJECTS", activeCount);

  const project = await prisma.project.create({
    data: { orgId: user.orgId, name, description, semester, startDate, endDate },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const user = await requireAuth();
  if (!(await canEditProject(user.id, user.roleId, projectId))) {
    throw new Error("You do not have permission to edit this project");
  }

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const semester = (formData.get("semester") as string).trim();
  const correctiveActionPlan =
    (formData.get("correctiveActionPlan") as string | null)?.trim() || null;
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;

  const startDate = parseDateInput(startDateRaw);
  const endDate = parseDateInput(endDateRaw);

  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be after start date");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { name, description, semester, correctiveActionPlan, startDate, endDate },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProjects(ids: string[]) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  if (!ids || ids.length === 0) return;

  await prisma.project.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/projects");
}

/**
 * Period rollover: clone a project (name, description, member assignments with
 * roles) into a new period with a fresh deliverables/standings slate, optionally
 * archiving the source in the same gesture. Returns the new project's id so the
 * dialog can navigate to it (no redirect — callers handle errors inline).
 */
export async function carryProjectToPeriod(projectId: string, formData: FormData) {
  const user = await requirePermission(Permission.MANAGE_PROJECTS);
  const orgId = user.orgId;

  const semester = (formData.get("semester") as string | null)?.trim();
  const archiveSource = formData.get("archiveSource") === "on";
  if (!semester) throw new Error("A new period is required");

  const source = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    include: { assignments: { select: { userId: true, role: true } } },
  });
  if (!source) throw new Error("Project not found");

  const duplicate = await prisma.project.findFirst({
    where: { orgId, name: source.name, semester },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error(`"${source.name}" already exists in ${semester}`);
  }

  // Rollover creates a new active project — subject to the same plan quota (set 37).
  const activeCount = await forOrg(orgId).project.count({ where: { archivedAt: null } });
  await assertWithinLimit(orgId, "MAX_PROJECTS", activeCount);

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        orgId,
        name: source.name,
        description: source.description,
        semester,
        assignments: {
          createMany: {
            // Nested create — extension hooks don't fire, so stamp orgId explicitly.
            data: source.assignments.map((a) => ({ orgId, userId: a.userId, role: a.role })),
          },
        },
      },
    });
    if (archiveSource) {
      await tx.project.update({
        where: { id: projectId },
        data: { archivedAt: new Date() },
      });
    }
    return project;
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/action-items");
  revalidatePath("/pm/review");

  return { id: created.id };
}

/**
 * Archive is a listing/engine filter, not a write lock: archived projects drop out
 * of listings, dashboards, red-flag and notification runs, but stay directly
 * accessible and editable (set-25 standing decision).
 */
export async function setProjectArchived(projectId: string, archived: boolean) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/action-items");
  revalidatePath("/pm/review");
}

export async function overrideProjectStatus(
  projectId: string,
  status: ProjectStatus,
  override: boolean
) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.project.update({
    where: { id: projectId },
    data: { status, statusOverride: override },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function assignMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole
) {
  const actor = await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.projectAssignment.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { orgId: actor.orgId, projectId, userId, role },
    update: { role },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole
) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.projectAssignment.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/members`);
}

export async function removeMember(projectId: string, userId: string) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.projectAssignment.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  revalidatePath(`/projects/${projectId}`);
}
