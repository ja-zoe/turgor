"use client";

import { useState, useTransition, type ReactElement } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateDeliverable } from "@/lib/actions/deliverables";
import { MarkdownEditor } from "@/components/markdown-editor";

type TimelineStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
type Priority = "LOW" | "MEDIUM" | "HIGH";

interface EditableDeliverable {
  id: string;
  title: string;
  description: string | null;
  status: TimelineStatus;
  priority: Priority;
  group: string | null;
  startDate: string | null; // ISO
  targetDate: string; // ISO
}

const STATUS_OPTIONS: { value: TimelineStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETE", label: "Complete" },
];
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

export function DeliverableModal({
  deliverable,
  groups,
  hasSubtasks,
  trigger,
}: {
  deliverable: EditableDeliverable;
  groups: string[];
  hasSubtasks: boolean;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(deliverable.title);
  const [description, setDescription] = useState(deliverable.description ?? "");
  const [priority, setPriority] = useState<Priority>(deliverable.priority);
  const [group, setGroup] = useState(deliverable.group ?? "");
  const [startDate, setStartDate] = useState(toDateInput(deliverable.startDate));
  const [targetDate, setTargetDate] = useState(toDateInput(deliverable.targetDate));
  const [status, setStatus] = useState<TimelineStatus>(deliverable.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // reset to the deliverable's current values each time it opens
      setTitle(deliverable.title);
      setDescription(deliverable.description ?? "");
      setPriority(deliverable.priority);
      setGroup(deliverable.group ?? "");
      setStartDate(toDateInput(deliverable.startDate));
      setTargetDate(toDateInput(deliverable.targetDate));
      setStatus(deliverable.status);
      setError(null);
    }
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) { setError("Title is required"); return; }
    if (!targetDate) { setError("Target date is required"); return; }
    if (startDate && startDate > targetDate) { setError("Start date must be before the target date"); return; }

    const fd = new FormData();
    fd.set("title", trimmed);
    fd.set("description", description);
    fd.set("targetDate", targetDate);
    fd.set("startDate", startDate);
    fd.set("group", group);
    fd.set("priority", priority);
    if (!hasSubtasks) fd.set("status", status);

    startTransition(async () => {
      await updateDeliverable(deliverable.id, fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit deliverable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Title *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              data-testid="deliv-modal-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="deliv-modal-priority"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Group</label>
              <input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                list="deliv-modal-groups"
                placeholder="Ungrouped"
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="deliv-modal-group"
              />
              <datalist id="deliv-modal-groups">
                {groups.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Start date</label>
              <input
                type="date"
                value={startDate}
                max={targetDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="deliv-modal-start"
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Target date *</label>
              <input
                type="date"
                value={targetDate}
                min={startDate || undefined}
                onChange={(e) => setTargetDate(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="deliv-modal-target"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Status</label>
            {hasSubtasks ? (
              <p className="text-xs text-muted-foreground italic">
                Status is derived from subtasks and can't be set here.
              </p>
            ) : (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TimelineStatus)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="deliv-modal-status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Description</label>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              rows={3}
              placeholder="Describe this deliverable… (Markdown supported)"
              textareaTestId="deliv-modal-description"
            />
          </div>

          {error && <p className="text-xs text-[#A4503C]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-sm text-muted-foreground clickable-icon"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              data-testid="deliv-modal-submit"
              className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
