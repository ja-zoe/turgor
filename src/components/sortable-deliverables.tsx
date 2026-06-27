"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, SortAscending, ArrowsDownUp } from "@phosphor-icons/react";
import { getDisplayName } from "@/lib/utils";

type TimelineStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";

interface Subtask {
  id: string;
  title: string;
  status: TimelineStatus;
  assignee: { id: string; firstName: string | null; nickname: string | null; name: string | null; email: string } | null;
  dueDate: string | null;
}

interface Deliverable {
  id: string;
  title: string;
  status: TimelineStatus;
  group: string | null;
  targetDate: string;
  startDate: string | null;
  completed: boolean;
  subtasks: Subtask[];
}

interface SortableDeliverablesProps {
  deliverables: Deliverable[];
  projectId: string;
  canManage: boolean;
  userId: string;
  deleteDeliverableAction: (id: string) => Promise<void>;
}

const STATUS_ORDER: Record<TimelineStatus, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  NOT_STARTED: 2,
  COMPLETE: 3,
};

const STATUS_DOT: Record<TimelineStatus, string> = {
  COMPLETE: "bg-[#588157]",
  BLOCKED: "bg-[#A4503C]",
  IN_PROGRESS: "bg-[#1F6C9F]",
  NOT_STARTED: "bg-[#787774]",
};

const STATUS_BADGE: Record<TimelineStatus, { bg: string; text: string; label: string }> = {
  NOT_STARTED: { bg: "bg-muted", text: "text-muted-foreground", label: "Not Started" },
  IN_PROGRESS: { bg: "bg-[#E1F3FE]", text: "text-[#1F6C9F]", label: "In Progress" },
  BLOCKED: { bg: "bg-[#FDEBEC]", text: "text-[#A4503C]", label: "Blocked" },
  COMPLETE: { bg: "bg-[#EDF3EC]", text: "text-[#588157]", label: "Complete" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SortableDeliverables({
  deliverables,
  projectId,
  canManage,
  deleteDeliverableAction,
}: SortableDeliverablesProps) {
  const [sortByStatus, setSortByStatus] = useState(false);

  const sorted = sortByStatus
    ? [...deliverables].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      )
    : deliverables;

  // Group: when not sorting by status, group by the `group` field
  const useGroups = !sortByStatus && sorted.some((d) => d.group);

  let sections: { label: string | null; items: Deliverable[] }[] = [];

  if (useGroups) {
    const groupMap = new Map<string, Deliverable[]>();
    for (const d of sorted) {
      const key = d.group ?? "";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(d);
    }
    // Ungrouped first, then named groups alphabetically
    const ungrouped = groupMap.get("") ?? [];
    const namedGroups = [...groupMap.entries()]
      .filter(([k]) => k !== "")
      .sort(([a], [b]) => a.localeCompare(b));
    if (ungrouped.length) sections.push({ label: null, items: ungrouped });
    for (const [label, items] of namedGroups) {
      sections.push({ label, items });
    }
  } else {
    sections = [{ label: null, items: sorted }];
  }

  return (
    <div>
      {/* Sort toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Deliverables</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortByStatus((s) => !s)}
            className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
              sortByStatus
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {sortByStatus ? <SortAscending size={12} /> : <ArrowsDownUp size={12} />}
            {sortByStatus ? "Sorted by status" : "Sort by status"}
          </button>
          {canManage && (
            <Link
              href={`/projects/${projectId}/deliverables/new`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <Plus size={12} />
              Add deliverable
            </Link>
          )}
        </div>
      </div>

      {deliverables.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl text-center">
          <p className="text-sm text-muted-foreground">No deliverables yet.</p>
          {canManage && (
            <Link
              href={`/projects/${projectId}/deliverables/new`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Plus size={14} />
              Add first deliverable
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(({ label, items }, si) => (
            <div key={si}>
              {/* Group header */}
              {label && (
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {items.length}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {items.map((deliverable) => {
                  const badge = STATUS_BADGE[deliverable.status];
                  const isOverdue =
                    !deliverable.completed && new Date(deliverable.targetDate) < new Date();

                  return (
                    <div
                      key={deliverable.id}
                      className="border border-border rounded-xl overflow-hidden"
                    >
                      {/* Deliverable header */}
                      <div className="flex items-start justify-between gap-4 p-4 bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {deliverable.title}
                            </span>
                            <span
                              className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p
                            className="text-xs text-muted-foreground mt-1"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            Target: {formatDate(deliverable.targetDate)}
                            {deliverable.startDate && (
                              <> &middot; Start: {formatDate(deliverable.startDate)}</>
                            )}
                            {isOverdue && (
                              <span className="text-[#A4503C] ml-2">overdue</span>
                            )}
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={`/projects/${projectId}/deliverables/${deliverable.id}/edit`}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              Edit
                            </Link>
                            <form
                              action={async () => {
                                await deleteDeliverableAction(deliverable.id);
                              }}
                            >
                              <button
                                type="submit"
                                className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        )}
                      </div>

                      {/* Subtasks */}
                      {deliverable.subtasks.length > 0 && (
                        <div className="border-t border-border divide-y divide-border">
                          {deliverable.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center justify-between px-4 py-2.5 bg-background/50"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[subtask.status]}`}
                                />
                                <span className="text-xs text-foreground">{subtask.title}</span>
                                {subtask.assignee && (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {getDisplayName(subtask.assignee)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {subtask.dueDate && (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {new Date(subtask.dueDate).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                                {canManage && (
                                  <Link
                                    href={`/projects/${projectId}/deliverables/${deliverable.id}/subtasks/${subtask.id}/edit`}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    Edit
                                  </Link>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add subtask */}
                      {canManage && (
                        <div className="border-t border-border px-4 py-2">
                          <Link
                            href={`/projects/${projectId}/deliverables/${deliverable.id}/subtasks/new`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            <Plus size={10} />
                            Add subtask
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
