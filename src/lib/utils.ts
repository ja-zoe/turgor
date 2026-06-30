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

/**
 * Human-friendly "time ago" for a true datetime (e.g. MCP connection lastSeenAt).
 * "just now", "5m ago", "3h ago", "5d ago", "2mo ago", "1y ago".
 */
export function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}
