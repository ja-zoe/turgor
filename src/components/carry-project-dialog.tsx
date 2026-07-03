"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { carryProjectToPeriod } from "@/lib/actions/projects";
import { SemesterField } from "@/components/semester-field";
import { ActionSpinner, SuccessCheck, successDelay } from "@/components/action-feedback";

const labelClass =
  "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

/**
 * PM-only "carry into next period" rollover: clones the project (name, description,
 * members with roles) into a new period with a fresh deliverables/standings slate,
 * archiving the source by default, then navigates to the new project.
 */
export function CarryProjectDialog({
  projectId,
  projectName,
  memberCount,
  allSemesters,
  periodLabel,
  trigger,
}: {
  projectId: string;
  projectName: string;
  memberCount: number;
  allSemesters: string[];
  periodLabel: string;
  trigger: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [semester, setSemester] = useState("");
  const [archiveSource, setArchiveSource] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [carried, setCarried] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSemester("");
      setArchiveSource(true);
      setError(null);
      setCarried(false);
    }
  }

  function submit() {
    if (!semester.trim()) {
      setError(`New ${periodLabel.toLowerCase()} is required`);
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.set("semester", semester.trim());
    if (archiveSource) fd.set("archiveSource", "on");

    startTransition(async () => {
      try {
        const { id } = await carryProjectToPeriod(projectId, fd);
        setCarried(true);
        await successDelay();
        setOpen(false);
        router.push(`/projects/${id}`);
      } catch (e) {
        setCarried(false);
        setError((e as Error)?.message ?? "Could not carry the project");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="bg-card max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Carry into next {periodLabel.toLowerCase()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Creates a copy of <span className="font-medium text-foreground">{projectName}</span>{" "}
            with its {memberCount} member{memberCount !== 1 ? "s" : ""} and their roles.
            Deliverables, standings, meetings, and action items start fresh.
          </p>

          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
              New {periodLabel} *
            </label>
            <SemesterField
              value={semester}
              onChange={setSemester}
              options={allSemesters}
              testId="carry-project-semester"
              label={periodLabel.toLowerCase()}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={archiveSource}
              onChange={(e) => setArchiveSource(e.target.checked)}
              data-testid="carry-project-archive"
              className="cursor-pointer accent-[var(--primary)]"
            />
            Archive the current project
          </label>

          {error && (
            <p className="text-xs text-[#A4503C]" data-testid="carry-project-error">
              {error}
            </p>
          )}

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
              data-testid="carry-project-submit"
              data-state={carried ? "success" : isPending ? "pending" : "idle"}
              className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {carried ? (
                <>
                  <SuccessCheck />
                  Carried
                </>
              ) : isPending ? (
                <>
                  <ActionSpinner />
                  Carrying…
                </>
              ) : (
                "Carry project"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
