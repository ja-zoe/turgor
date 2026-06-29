"use client";

import { useEffect } from "react";
import { Warning, ArrowClockwise } from "@phosphor-icons/react";
import "./globals.css";

/**
 * Last-resort boundary that catches errors in the root layout itself. It replaces the
 * root layout, so it must render its own <html>/<body>. Kept dependency-light (no
 * providers / next-font loaders); fonts degrade gracefully to the CSS fallbacks while
 * the Forest Floor palette tokens from globals.css still apply.
 */
export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex items-center justify-center bg-background px-6 py-16">
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
            The app hit an unexpected error. Try reloading — if it keeps happening, let the team know.
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
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-4 py-2 hover:bg-muted transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
