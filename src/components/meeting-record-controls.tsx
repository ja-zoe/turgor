"use client";

import { useState, useTransition } from "react";
import { InlineConfirm } from "@/components/sortable-deliverables";
import { deleteMeetingRecord } from "@/lib/actions/meeting-records";

export function MeetingRecordControls({ recordId }: { recordId: string }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    startTransition(async () => {
      await deleteMeetingRecord(recordId);
      setConfirmingDelete(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid="meeting-record-controls">
      {confirmingDelete ? (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="meeting-delete-confirm"
        >
          Delete?
          <InlineConfirm show onConfirm={doDelete} onCancel={() => setConfirmingDelete(false)} disabled={isPending} />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="meeting-delete"
        >
          Delete
        </button>
      )}
    </span>
  );
}
