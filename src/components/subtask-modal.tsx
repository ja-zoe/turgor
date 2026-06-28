"use client";

import { useState, useTransition, type ReactElement } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSubtask, updateSubtask } from "@/lib/actions/deliverables";
import { getDisplayName } from "@/lib/utils";

type TimelineStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";

interface Member {
  id: string;
  firstName: string | null;
  nickname: string | null;
  name: string | null;
  email: string;
}

interface EditableSubtask {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  status: TimelineStatus;
}

const STATUS_OPTIONS: { value: TimelineStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETE", label: "Complete" },
];

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

interface SubtaskModalProps {
  mode: "create" | "edit";
  deliverableId: string;
  members: Member[];
  deliverableStart: string | null;
  deliverableTarget: string;
  subtask?: EditableSubtask;
  /** The element that opens the modal (merged via Base UI's `render`). */
  trigger: ReactElement;
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass =
  "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

export function SubtaskModal({
  mode,
  deliverableId,
  members,
  deliverableStart,
  deliverableTarget,
  subtask,
  trigger,
}: SubtaskModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(subtask?.title ?? "");
  const [description, setDescription] = useState(subtask?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(subtask?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(toDateInput(subtask?.dueDate));
  const [status, setStatus] = useState<TimelineStatus>(subtask?.status ?? "NOT_STARTED");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxDue = toDateInput(deliverableTarget);
  const minDue = toDateInput(deliverableStart);

  function resetForCreate() {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setDueDate("");
    setStatus("NOT_STARTED");
    setError(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && mode === "create") resetForCreate();
    if (next) setError(null);
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    if (dueDate && maxDue && dueDate > maxDue) {
      setError("Due date can't be after the deliverable's target date");
      return;
    }
    const fd = new FormData();
    fd.set("title", trimmed);
    fd.set("description", description);
    fd.set("dueDate", dueDate);
    fd.set("assigneeId", assigneeId);
    if (mode === "edit") fd.set("status", status);

    startTransition(async () => {
      if (mode === "create") await createSubtask(deliverableId, fd);
      else if (subtask) await updateSubtask(subtask.id, fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New subtask" : "Edit subtask"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
              Title *
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submit(); }
              }}
              placeholder="Subtask title"
              className={inputClass}
              data-testid="subtask-modal-title"
            />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details…"
              className={`${inputClass} resize-none`}
              data-testid="subtask-modal-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="subtask-modal-assignee"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getDisplayName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                min={minDue || undefined}
                max={maxDue || undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="subtask-modal-duedate"
              />
            </div>
          </div>

          {mode === "edit" && (
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TimelineStatus)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="subtask-modal-status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-[#A4503C]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
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
              data-testid="subtask-modal-submit"
              className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : mode === "create" ? "Add subtask" : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
