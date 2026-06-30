"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Trash } from "@phosphor-icons/react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createActionItem, updateActionItem, deleteActionItem } from "@/lib/actions/action-items";
import { InlineConfirm } from "@/components/sortable-deliverables";

export interface ActionItemDTO {
  id: string;
  description: string;
  ownerId: string | null;
  deadline: string | null; // ISO
}

export interface ActionItemAssignee {
  id: string;
  name: string;
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass =
  "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export function ActionItemModal({
  mode,
  projectId,
  assignees,
  item,
  trigger,
}: {
  mode: "create" | "edit";
  projectId: string;
  assignees: ActionItemAssignee[];
  item?: ActionItemDTO;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(item?.description ?? "");
  const [ownerId, setOwnerId] = useState(item?.ownerId ?? "");
  const [deadline, setDeadline] = useState(toDateInput(item?.deadline));
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetForCreate() {
    setDescription("");
    setOwnerId("");
    setDeadline("");
    setError(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && mode === "create") resetForCreate();
    if (next) setError(null);
    if (next) setConfirmingDelete(false);
  }

  function doDelete() {
    if (!item) return;
    startTransition(async () => {
      await deleteActionItem(item.id);
      setOpen(false);
    });
  }

  function submit() {
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Description is required");
      return;
    }
    const fd = new FormData();
    fd.set("description", trimmed);
    fd.set("ownerId", ownerId);
    fd.set("deadline", deadline);

    startTransition(async () => {
      if (mode === "create") await createActionItem(projectId, fd);
      else if (item) await updateActionItem(item.id, fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New action item" : "Edit action item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
              Description *
            </label>
            <textarea
              autoFocus
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
              }}
              placeholder="What needs to be done?"
              className={`${inputClass} resize-none`}
              data-testid="action-item-modal-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
                Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="action-item-modal-owner"
              >
                <option value="">No owner</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="action-item-modal-deadline"
              />
            </div>
          </div>

          {error && <p className="text-xs text-[#A4503C]">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              {mode === "edit" && item && (
                confirmingDelete ? (
                  <span
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                    data-testid="action-item-modal-delete-confirm"
                  >
                    Delete?
                    <InlineConfirm
                      show
                      onConfirm={doDelete}
                      onCancel={() => setConfirmingDelete(false)}
                      disabled={isPending}
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={isPending}
                    data-testid="action-item-modal-delete"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#A4503C] transition-colors disabled:opacity-50"
                  >
                    <Trash size={14} /> Delete
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              data-testid="action-item-modal-submit"
              className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : mode === "create" ? "Add action item" : "Save changes"}
            </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
