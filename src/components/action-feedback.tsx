"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleNotch, Check } from "@phosphor-icons/react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Shared CRUD-feedback primitives (R22.4). Every mutation trigger in the app renders
 * a spinner while its action is pending and a brief success check once it settles,
 * built from these pieces so the feel is identical everywhere.
 */

/** How long the success check stays visible before the control returns to idle. */
export const SUCCESS_FLASH_MS = 900;

/** Spinner for any pending mutation control. */
export function ActionSpinner({ size = 13, className = "" }: { size?: number; className?: string }) {
  return (
    <CircleNotch size={size} weight="bold" className={`animate-spin shrink-0 ${className}`} aria-hidden />
  );
}

/** Success check that pops in with a small overshoot; instant under prefers-reduced-motion. */
export function SuccessCheck({ size = 13, className = "" }: { size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.5)" }
        );
      });
    },
    { scope: ref }
  );
  return (
    <span ref={ref} className={`inline-flex shrink-0 ${className}`} data-testid="success-check" aria-hidden>
      <Check size={size} weight="bold" />
    </span>
  );
}

/**
 * True for SUCCESS_FLASH_MS after `pending` transitions true → false. Lets a control
 * that already tracks its own useTransition/useFormStatus pending flag flash a success
 * state without restructuring its data flow. Callers with an error state should gate:
 * `settled && !error` (a failed action also ends its transition).
 */
export function useSettleFlash(pending: boolean): boolean {
  const [settled, setSettled] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (wasPending.current && !pending) {
      setSettled(true);
      timer = setTimeout(() => setSettled(false), SUCCESS_FLASH_MS);
    }
    wasPending.current = pending;
    return () => { if (timer) clearTimeout(timer); };
  }, [pending]);
  return settled;
}

/**
 * Hold for the success flash before hiding the surface (modals that close on success
 * await this so the confirmation is actually seen).
 */
export function successDelay(ms: number = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit button for server-component `<form action={…}>` one-click controls (e.g. the
 * My Tasks quick-completes): renders its idle icon, swaps to a spinner while the form
 * action is pending. Must be rendered inside the form (useFormStatus).
 */
export function PendingIconButton({
  title,
  className,
  spinnerSize = 12,
  children,
  ["data-testid"]: testId,
}: {
  title?: string;
  className?: string;
  spinnerSize?: number;
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title={title} className={className} data-testid={testId}>
      {pending ? <ActionSpinner size={spinnerSize} /> : children}
    </button>
  );
}
