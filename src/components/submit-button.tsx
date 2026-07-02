"use client";

import { useFormStatus } from "react-dom";
import { ActionSpinner, SuccessCheck, useSettleFlash } from "@/components/action-feedback";

interface SubmitButtonProps {
  label: string;
  pendingLabel?: string;
  successLabel?: string;
  className?: string;
}

export function SubmitButton({
  label,
  pendingLabel,
  successLabel,
  className = "rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  // Settles on both success and failure; forms that stay mounted after an action error
  // re-render with their error UI, and the brief check is suppressed by the reset below
  // only in future renders — acceptable for plain form-action surfaces.
  const settled = useSettleFlash(pending);

  const pendingText = pendingLabel ?? "Saving…";
  const successText = successLabel ?? "Saved";

  // Grid-stack all three states so the button width is the widest label — no layout shift.
  return (
    <button type="submit" disabled={pending} className={className} data-state={pending ? "pending" : settled ? "success" : "idle"}>
      <span className="grid place-items-center">
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 ${pending || settled ? "invisible" : ""}`}>
          {label}
        </span>
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 ${pending ? "" : "invisible"}`}>
          <ActionSpinner />
          {pendingText}
        </span>
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 ${!pending && settled ? "" : "invisible"}`}>
          {!pending && settled && <SuccessCheck />}
          {successText}
        </span>
      </span>
    </button>
  );
}
