"use client";

import { useState, useTransition, type ReactElement } from "react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { InlineConfirm } from "@/components/sortable-deliverables";
import { updateStatusUpdate, deleteStatusUpdate } from "@/lib/actions/status-updates";

interface StatusUpdateData {
  id: string;
  plannedWork: string;
  actualProgress: string;
  blockers: string;
  nextWeekGoals: string;
  needsHelp: boolean;
  helpNeeded: string | null;
}

const fieldClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none";
const labelClass = "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

const FIELDS: { name: keyof StatusUpdateData; label: string }[] = [
  { name: "plannedWork", label: "Planned Work" },
  { name: "actualProgress", label: "Actual Progress" },
  { name: "blockers", label: "Blockers" },
  { name: "nextWeekGoals", label: "Next Week's Goals" },
];

function EditModal({ update, trigger }: { update: StatusUpdateData; trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState(update);
  const [isPending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setVals(update);
  }
  function submit() {
    const fd = new FormData();
    fd.set("plannedWork", vals.plannedWork);
    fd.set("actualProgress", vals.actualProgress);
    fd.set("blockers", vals.blockers);
    fd.set("nextWeekGoals", vals.nextWeekGoals);
    if (vals.needsHelp) fd.set("needsHelp", "on");
    fd.set("helpNeeded", vals.helpNeeded ?? "");
    startTransition(async () => {
      await updateStatusUpdate(update.id, fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit project standing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {FIELDS.map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>{label}</label>
              <textarea
                rows={2}
                value={vals[name] as string}
                onChange={(e) => setVals((v) => ({ ...v, [name]: e.target.value }))}
                className={fieldClass}
                data-testid={`status-edit-${name}`}
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)} disabled={isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="button" onClick={submit} disabled={isPending} data-testid="status-edit-submit"
              className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors">
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StatusUpdateControls({ update }: { update: StatusUpdateData }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    startTransition(async () => {
      await deleteStatusUpdate(update.id);
      setConfirmingDelete(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-2 ml-auto" data-testid="status-update-controls">
      <EditModal
        update={update}
        trigger={
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
            data-testid="status-edit"
          >
            Edit
          </button>
        }
      />
      {confirmingDelete ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }} data-testid="status-delete-confirm">
          Delete?
          <InlineConfirm show onConfirm={doDelete} onCancel={() => setConfirmingDelete(false)} disabled={isPending} />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="status-delete"
        >
          Delete
        </button>
      )}
    </span>
  );
}
