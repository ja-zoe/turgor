"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Warning, ArrowClockwise, House } from "@phosphor-icons/react";

/**
 * Catch-all error boundary for the authenticated app shell. Rendered *inside*
 * (app)/layout.tsx, so the sidebar/session chrome stays — only the page body is replaced.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#FDEBEC]">
          <Warning size={22} weight="fill" className="text-[#A4503C]" />
        </div>
        <h1
          className="text-3xl text-foreground"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
        >
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. You can try again, or head back to your dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
            Ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors"
          >
            <ArrowClockwise size={14} /> Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-4 py-2 hover:bg-muted transition-colors"
          >
            <House size={14} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
