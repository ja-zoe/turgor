"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { InlineConfirm } from "@/components/sortable-deliverables";
import { deleteUser } from "@/lib/actions/users";

/**
 * PM control to delete (anonymizing soft-delete) an active user, using the shared
 * InlineConfirm ✓/✗ microinteraction. Mirrors MeetingRecordControls. Never rendered on
 * the PM's own row (the server action also hard-guards against self-delete). R18.2.
 */
export function UserRowControls({ userId }: { userId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser(userId);
        setConfirming(false);
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to delete user");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid="user-row-controls">
      {error && (
        <span className="text-xs text-[#A4503C]" data-testid="user-delete-error">
          {error}
        </span>
      )}
      {confirming ? (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="user-delete-confirm"
        >
          Delete?
          <InlineConfirm
            show
            onConfirm={doDelete}
            onCancel={() => setConfirming(false)}
            disabled={isPending}
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-muted-foreground hover:text-[#A4503C] transition-colors"
          title="Delete user"
          data-testid="user-delete"
        >
          <Trash size={15} />
        </button>
      )}
    </span>
  );
}
