"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { Permission, ProjectMemberRole, ProjectStatus } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const semester = (formData.get("semester") as string).trim();
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;

  if (!name || !semester) throw new Error("Name and semester are required");

  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be after start date");
  }

  const project = await prisma.project.create({
    data: { name, description, semester, startDate, endDate },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const semester = (formData.get("semester") as string).trim();
  const correctiveActionPlan =
    (formData.get("correctiveActionPlan") as string | null)?.trim() || null;
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;

  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

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
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.projectAssignment.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeMember(projectId: string, userId: string) {
  await requirePermission(Permission.MANAGE_PROJECTS);

  await prisma.projectAssignment.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  revalidatePath(`/projects/${projectId}`);
}
