"use client";

import { useTransition } from "react";
import { Plus, Check, ArrowClockwise, PencilSimple } from "@phosphor-icons/react";
import { closeActionItem, reopenActionItem } from "@/lib/actions/action-items";
import { ActionItemModal, type ActionItemAssignee } from "@/components/action-item-modal";

export interface ActionItemRowDTO {
  id: string;
  description: string;
  ownerId: string | null;
  ownerName: string | null;
  deadline: string | null; // ISO
  status: "OPEN" | "DONE";
  carriedOver: boolean;
}

export function ActionItemsSection({
  projectId,
  items,
  assignees,
  canCreate,
  canClose,
  currentUserId,
}: {
  projectId: string;
  items: ActionItemRowDTO[];
  assignees: ActionItemAssignee[];
  canCreate: boolean;
  canClose: boolean;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const openItems = items.filter((i) => i.status === "OPEN");
  const doneItems = items.filter((i) => i.status === "DONE");

  function close(id: string) {
    startTransition(async () => { await closeActionItem(id); });
  }
  function reopen(id: string) {
    startTransition(async () => { await reopenActionItem(id); });
  }

  return (
    <div>
      {canCreate && (
        <div className="mb-4">
          <ActionItemModal
            mode="create"
            projectId={projectId}
            assignees={assignees}
            trigger={
              <button
                type="button"
                data-testid="action-item-new"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
              >
                <Plus size={14} /> New action item
              </button>
            }
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No action items yet.</p>
      ) : (
        <div className="space-y-2">
          {openItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 px-4 py-3 bg-card border border-border rounded-lg"
              data-testid="action-item-row"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{item.description}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {item.ownerName && (
                    <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                      {item.ownerName}
                    </span>
                  )}
                  {item.deadline && (
                    <span
                      className={`text-xs ${new Date(item.deadline) < new Date() ? "text-[#A4503C]" : "text-muted-foreground"}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      due{" "}
                      {new Date(item.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {item.carriedOver && (
                    <span
                      className="text-xs text-[#C99846] bg-[#FBF3DB] px-1.5 py-0.5 rounded"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      carried over
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canCreate && (
                  <ActionItemModal
                    mode="edit"
                    projectId={projectId}
                    assignees={assignees}
                    item={{ id: item.id, description: item.description, ownerId: item.ownerId, deadline: item.deadline }}
                    trigger={
                      <button
                        type="button"
                        title="Edit"
                        data-testid="action-item-edit"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <PencilSimple size={12} />
                      </button>
                    }
                  />
                )}
                {(canClose || item.ownerId === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => close(item.id)}
                    disabled={isPending}
                    title="Mark done"
                    className="flex-shrink-0 w-6 h-6 rounded border border-border hover:border-[#588157] hover:bg-[#EDF3EC] transition-colors flex items-center justify-center text-muted-foreground hover:text-[#588157] disabled:opacity-50"
                  >
                    <Check size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {doneItems.length > 0 && (
            <details className="mt-2">
              <summary
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {doneItems.length} completed item{doneItems.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {doneItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card border border-border rounded-lg opacity-60"
                  >
                    <p className="text-sm text-foreground line-through">{item.description}</p>
                    {canClose && (
                      <button
                        type="button"
                        onClick={() => reopen(item.id)}
                        disabled={isPending}
                        title="Re-open"
                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <ArrowClockwise size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
