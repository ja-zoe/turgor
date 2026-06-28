"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

export async function createEvent(formData: FormData) {
  await requirePermission(Permission.MANAGE_CALENDAR);

  const title = (formData.get("title") as string).trim();
  const semester = (formData.get("semester") as string).trim();
  const type = (formData.get("type") as string) as "PROJECT_MEETING" | "NON_PROJECT_EVENT";
  const startsAtRaw = formData.get("startsAt") as string;
  const endsAtRaw = formData.get("endsAt") as string | null;
  const allDay = formData.get("allDay") === "true";
  const location = (formData.get("location") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const projectId = (formData.get("projectId") as string | null)?.trim() || null;

  if (!title || !semester || !startsAtRaw) throw new Error("title, semester, and startsAt are required");

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (endsAt && endsAt < startsAt) throw new Error("endsAt must be after startsAt");

  await prisma.calendarEvent.create({
    data: { title, semester, type, startsAt, endsAt, allDay, location, description, projectId },
  });

  revalidatePath("/calendar");
}

export async function updateEvent(eventId: string, formData: FormData) {
  await requirePermission(Permission.MANAGE_CALENDAR);

  const title = (formData.get("title") as string | null)?.trim();
  const semester = (formData.get("semester") as string | null)?.trim();
  const type = formData.get("type") as "PROJECT_MEETING" | "NON_PROJECT_EVENT" | null;
  const startsAtRaw = formData.get("startsAt") as string | null;
  const endsAtRaw = formData.get("endsAt") as string | null;
  const allDayRaw = formData.get("allDay");
  const location = (formData.get("location") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const projectId = (formData.get("projectId") as string | null)?.trim() || null;

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : undefined;
  const endsAt = endsAtRaw !== null ? (endsAtRaw ? new Date(endsAtRaw) : null) : undefined;

  if (startsAt && endsAt && endsAt < startsAt) throw new Error("endsAt must be after startsAt");

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(title ? { title } : {}),
      ...(semester ? { semester } : {}),
      ...(type ? { type } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
      ...(allDayRaw !== null ? { allDay: allDayRaw === "true" } : {}),
      location,
      description,
      projectId,
    },
  });

  revalidatePath("/calendar");
}

export async function deleteEvent(eventId: string) {
  await requirePermission(Permission.MANAGE_CALENDAR);
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath("/calendar");
}
