"use client";

import { useState, useTransition, type ReactElement } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateProject, deleteProject } from "@/lib/actions/projects";
import { isValidDateInput } from "@/lib/date";
import { MarkdownEditor } from "@/components/markdown-editor";
import { InlineConfirm } from "@/components/sortable-deliverables";
import { SemesterField } from "@/components/semester-field";
import { ActionSpinner, SuccessCheck, successDelay } from "@/components/action-feedback";

interface EditableProject {
  id: string;
  name: string;
  semester: string;
  description: string | null;
  correctiveActionPlan: string | null;
  startDate: string | null; // ISO
  endDate: string | null; // ISO
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

export function ProjectModal({
  project,
  allSemesters,
  trigger,
  canDelete = true,
}: {
  project: EditableProject;
  allSemesters: string[];
  trigger: ReactElement;
  /** Whether to show the Delete button. Deleting is PM-only, so leads editing
   *  their own project should not see it. */
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [semester, setSemester] = useState(project.semester);
  const [description, setDescription] = useState(project.description ?? "");
  const [cap, setCap] = useState(project.correctiveActionPlan ?? "");
  const [startDate, setStartDate] = useState(toDateInput(project.startDate));
  const [endDate, setEndDate] = useState(toDateInput(project.endDate));
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(project.name);
      setSemester(project.semester);
      setDescription(project.description ?? "");
      setCap(project.correctiveActionPlan ?? "");
      setStartDate(toDateInput(project.startDate));
      setEndDate(toDateInput(project.endDate));
      setError(null);
      setConfirmingDelete(false);
    }
  }

  function submit() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!semester.trim()) { setError("Semester is required"); return; }
    if (!isValidDateInput(startDate)) { setError("Start date is not a valid date"); return; }
    if (!isValidDateInput(endDate)) { setError("End date is not a valid date"); return; }
    if (startDate && endDate && endDate < startDate) { setError("End date must be after start date"); return; }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("semester", semester.trim());
    fd.set("description", description);
    fd.set("correctiveActionPlan", cap);
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);

    startTransition(async () => {
      try {
        await updateProject(project.id, fd);
        setSaved(true);
        await successDelay();
        setOpen(false);
        setSaved(false);
      } catch (e) {
        setSaved(false);
        setError((e as Error)?.message ?? "Could not save the project");
      }
    });
  }

  function doDelete() {
    startTransition(async () => {
      await deleteProject(project.id); // redirects to /projects
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Name *</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                data-testid="project-modal-name"
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Semester *</label>
              <SemesterField
                value={semester}
                onChange={setSemester}
                options={allSemesters}
                testId="project-modal-semester"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Start date</label>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="project-modal-start"
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>End date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="project-modal-end"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Description</label>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              rows={3}
              placeholder="Describe this project… (Markdown supported)"
              textareaTestId="project-modal-description"
            />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Corrective action plan</label>
            <MarkdownEditor
              value={cap}
              onChange={setCap}
              rows={2}
              placeholder="If the project is behind, what's the plan?"
              textareaTestId="project-modal-cap"
            />
          </div>

          {error && <p className="text-xs text-[#A4503C]">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Delete (armed confirm) on the left — PM-only */}
            {!canDelete ? (
              <span />
            ) : confirmingDelete ? (
              <span className="inline-flex items-center gap-1 text-xs text-[#A4503C]" data-testid="project-modal-delete-confirm">
                {isPending ? <ActionSpinner size={11} /> : null}
                Delete project?
                <InlineConfirm show onConfirm={doDelete} onCancel={() => setConfirmingDelete(false)} disabled={isPending} />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={isPending}
                data-testid="project-modal-delete"
                className="text-xs text-muted-foreground clickable-danger"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Delete project
              </button>
            )}

            <div className="flex items-center gap-3">
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
                data-testid="project-modal-submit"
                data-state={saved ? "success" : isPending ? "pending" : "idle"}
                className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                {saved ? (
                  <>
                    <SuccessCheck />
                    Saved
                  </>
                ) : isPending ? (
                  <>
                    <ActionSpinner />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
