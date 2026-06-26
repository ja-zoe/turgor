import type { ProjectStatus, TimelineStatus } from "@prisma/client";

/** Short date, e.g. "Oct 1, 2026". */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Date + time, e.g. "Oct 1, 2026, 3:40 PM". */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative-ish phrasing for deadlines, e.g. "in 3 days", "2 days overdue". */
export function fmtDeadline(d: Date | string | null | undefined): string {
  if (!d) return "No deadline";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  BEHIND: "Behind",
};

/** Maps a project status to its badge CSS class. */
export const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  ON_TRACK: "badge-on-track",
  AT_RISK: "badge-at-risk",
  BEHIND: "badge-behind",
};

/** Status hex for charts (matches the status tokens in globals.css). */
export const STATUS_CHART_COLOR: Record<ProjectStatus, string> = {
  ON_TRACK: "#4ca876",
  AT_RISK: "#d4953a",
  BEHIND: "#d45a4a",
};

/** Forest Floor series palette: woodland greens, sage, amber, clay. */
export const CHART_COLORS = ["#4ca876", "#5a9a72", "#9ab087", "#d4953a", "#d45a4a", "#6b8f76"];

// --- Semester-timeline status (deliverables + subtasks) ---------------------

export const TIMELINE_STATUS_LABEL: Record<TimelineStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
};

export const TIMELINE_STATUS_BADGE_CLASS: Record<TimelineStatus, string> = {
  NOT_STARTED: "badge-neutral",
  IN_PROGRESS: "badge-at-risk",
  BLOCKED: "badge-behind",
  COMPLETE: "badge-on-track",
};
