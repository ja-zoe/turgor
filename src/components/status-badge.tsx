import { ProjectStatus, TimelineStatus } from "@/generated/prisma";

const PROJECT_STATUS_MAP: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  ON_TRACK: {
    label: "On Track",
    className: "bg-[#EDF3EC] text-[#588157]",
  },
  AT_RISK: {
    label: "At Risk",
    className: "bg-[#FBF3DB] text-[#C99846]",
  },
  BEHIND: {
    label: "Behind",
    className: "bg-[#FDEBEC] text-[#A4503C]",
  },
};

const TIMELINE_STATUS_MAP: Record<
  TimelineStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-[#F4F1EA] text-[#787774]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-[#E1F3FE] text-[#1F6C9F]",
  },
  BLOCKED: {
    label: "Blocked",
    className: "bg-[#FDEBEC] text-[#A4503C]",
  },
  COMPLETE: {
    label: "Complete",
    className: "bg-[#EDF3EC] text-[#588157]",
  },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = PROJECT_STATUS_MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase ${className}`}
      style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
    >
      {label}
    </span>
  );
}

export function TimelineStatusBadge({ status }: { status: TimelineStatus }) {
  const { label, className } = TIMELINE_STATUS_MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase ${className}`}
      style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
    >
      {label}
    </span>
  );
}
