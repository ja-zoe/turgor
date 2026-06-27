"use client";

import { useState, useTransition } from "react";
import { Trash, XCircle } from "@phosphor-icons/react";
import { deleteProject } from "@/lib/actions/projects";

interface Props {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({ projectId, projectName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteProject(projectId);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#A4503C]/30 bg-[#FDEBEC]/50 text-sm font-medium text-[#A4503C] px-4 py-2 hover:bg-[#FDEBEC] hover:border-[#A4503C]/60 transition-colors"
      >
        <Trash size={14} />
        Delete project
      </button>
    );
  }

  return (
    <div className="p-4 rounded-md border border-[#A4503C]/30 bg-[#FDEBEC]/50 space-y-3">
      <div className="flex items-start gap-2">
        <XCircle size={16} className="text-[#A4503C] mt-0.5 flex-shrink-0" weight="fill" />
        <p className="text-sm text-[#A4503C]">
          <span className="font-medium">Permanently delete "{projectName}"?</span> This will
          delete all deliverables, meetings, status updates, and action items. This cannot be undone.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-md bg-[#A4503C] text-white text-sm font-medium px-4 py-2 hover:bg-[#A4503C]/80 transition-colors disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Yes, delete project"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
