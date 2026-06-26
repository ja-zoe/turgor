"use client";

interface DeliverableProgressProps {
  deliverables: {
    id: string;
    title: string;
    completed: boolean;
    subtasksTotal: number;
    subtasksDone: number;
  }[];
}

export function DeliverableProgress({ deliverables }: DeliverableProgressProps) {
  if (deliverables.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        No deliverables yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {deliverables.map((d) => {
        const pct =
          d.completed
            ? 100
            : d.subtasksTotal === 0
              ? 0
              : Math.round((d.subtasksDone / d.subtasksTotal) * 100);

        return (
          <div key={d.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground truncate max-w-[70%]">{d.title}</span>
              <span
                className="text-xs text-muted-foreground ml-2 flex-shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {d.completed
                  ? "done"
                  : d.subtasksTotal === 0
                    ? "no subtasks"
                    : `${d.subtasksDone}/${d.subtasksTotal}`}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: d.completed ? "#588157" : pct > 50 ? "#A3B18A" : "#2E4034",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
