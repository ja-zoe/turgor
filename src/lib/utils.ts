import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDisplayName(user: {
  firstName?: string | null;
  nickname?: string | null;
  name?: string | null;
  email: string;
}): string {
  return user.nickname ?? user.firstName ?? user.name ?? user.email.split("@")[0];
}

export function projectDuration(start: Date, end: Date | null): string {
  const to = end ?? new Date();
  const ms = to.getTime() - start.getTime();
  if (ms <= 0) return "0 days";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 14) return `${days} day${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} wk`;
  const months = Math.round(days / 30.44);
  return `${months} mo`;
}

/**
 * Format a **date-only** value (stored as UTC-midnight because it came from a
 * `type="date"` input) without shifting it into the viewer's timezone. Using the local
 * zone would render the previous day for sub-UTC users (the user base is US Eastern).
 * Use this for deadlines, due dates, target/start dates, project dates, and meeting-record
 * dates — NOT for true datetimes (createdAt, calendar event times, etc.).
 */
export function formatDateOnly(
  d: Date | string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return new Date(d).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function formatProjectDate(d: Date): string {
  return formatDateOnly(d, { month: "short", year: "numeric" });
}
