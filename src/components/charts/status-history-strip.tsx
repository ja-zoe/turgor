"use client";

type ProjectStatus = "ON_TRACK" | "AT_RISK" | "BEHIND";

interface StatusPoint {
  week: string;
  status: ProjectStatus;
}

interface StatusHistoryStripProps {
  data: StatusPoint[];
}

const STATUS_COLORS: Record<ProjectStatus, { bg: string; label: string }> = {
  ON_TRACK: { bg: "#588157", label: "On Track" },
  AT_RISK: { bg: "#C99846", label: "At Risk" },
  BEHIND: { bg: "#A4503C", label: "Behind" },
};

export function StatusHistoryStrip({ data }: StatusHistoryStripProps) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        No records yet
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {data.map((point, i) => {
        const { bg, label } = STATUS_COLORS[point.status];
        return (
          <div key={i} className="relative group">
            <div
              className="w-6 h-6 rounded-sm cursor-default"
              style={{ backgroundColor: bg }}
              title={`${point.week}: ${label}`}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-card border border-border rounded px-2 py-1 whitespace-nowrap">
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  {point.week}
                </p>
                <p className="text-xs font-medium text-foreground">{label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
