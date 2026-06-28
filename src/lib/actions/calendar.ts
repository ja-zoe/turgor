"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Permission, CalendarEventType } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

/**
 * Resolve the semester set from the form. `semesters` may carry multiple values
 * (lead/eboard meetings pinned across semesters); otherwise we fall back to the
 * single active semester. The returned `semester` (primary) is always one of the
 * `semesters` and is used for the calendar's single-semester display column.
 */
function resolveSemesters(formData: FormData, fallback: string): { semester: string; semesters: string[] } {
  const picked = formData
    .getAll("semesters")
    .map((s) => (s as string).trim())
    .filter(Boolean);
  const unique = [...new Set(picked.length > 0 ? picked : fallback ? [fallback] : [])];
  const semester = unique.includes(fallback) && fallback ? fallback : (unique[0] ?? "");
  return { semester, semesters: unique };
}

export async function createEvent(formData: FormData) {
  await requirePermission(Permission.MANAGE_CALENDAR);

  const title = (formData.get("title") as string).trim();
  const fallbackSemester = (formData.get("semester") as string).trim();
  const type = (formData.get("type") as string) as CalendarEventType;
  const startsAtRaw = formData.get("startsAt") as string;
  const endsAtRaw = formData.get("endsAt") as string | null;
  const allDay = formData.get("allDay") === "true";
  const location = (formData.get("location") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const projectId = (formData.get("projectId") as string | null)?.trim() || null;

  // semesters[] is the set a lead/eboard meeting is pinned to; for other event types
  // it's just the single active semester. Always falls back to the active semester.
  const { semester, semesters } = resolveSemesters(formData, fallbackSemester);

  if (!title || !semester || !startsAtRaw) throw new Error("title, semester, and startsAt are required");

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (endsAt && endsAt < startsAt) throw new Error("endsAt must be after startsAt");

  await prisma.calendarEvent.create({
    data: { title, semester, semesters, type, startsAt, endsAt, allDay, location, description, projectId },
  });

  revalidatePath("/calendar");
}

export async function updateEvent(eventId: string, formData: FormData) {
  await requirePermission(Permission.MANAGE_CALENDAR);

  const title = (formData.get("title") as string | null)?.trim();
  const fallbackSemester = (formData.get("semester") as string | null)?.trim() ?? "";
  // If the form supplied any semesters (the edit form always does), recompute the set.
  const pickedSemesters = formData
    .getAll("semesters")
    .map((s) => (s as string).trim())
    .filter(Boolean);
  const hasSemesterField = formData.has("semester") || pickedSemesters.length > 0;
  const resolved = hasSemesterField ? resolveSemesters(formData, fallbackSemester) : null;
  const type = formData.get("type") as CalendarEventType | null;
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
      ...(resolved && resolved.semester ? { semester: resolved.semester, semesters: resolved.semesters } : {}),
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
