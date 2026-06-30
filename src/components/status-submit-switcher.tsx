"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/submit-button";

export type PendingMeetingDTO = {
  id: string;
  title: string;
  startsAt: string; // ISO
  isLate: boolean;
};

const FIELDS = [
  { name: "plannedWork", label: "Planned Work for This Week", placeholder: "What did you plan to accomplish this week?" },
  { name: "actualProgress", label: "Actual Progress", placeholder: "What did you actually complete? What didn't happen?" },
  { name: "blockers", label: "Blockers", placeholder: "What is slowing you down? (Write 'None' if no blockers)" },
  { name: "nextWeekGoals", label: "Next Week's Goals", placeholder: "What will you commit to for next week?" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function StatusSubmitSwitcher({
  projectId,
  pending,
  action,
}: {
  projectId: string;
  pending: PendingMeetingDTO[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const current = pending[index];
  const many = pending.length > 1;

  return (
    <div className="space-y-6">
      {many && (
        <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="standing-switcher">
          <p className="text-sm font-medium text-foreground">
            You have{" "}
            <span data-testid="pending-count">{pending.length}</span>{" "}
            Project Standing Updates to submit
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="cursor-pointer inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors"
              aria-label="Previous meeting"
              data-testid="switcher-prev"
            >
              <CaretLeft size={14} />
            </button>
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {index + 1} / {pending.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(pending.length - 1, i + 1))}
              disabled={index === pending.length - 1}
              className="cursor-pointer inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-default transition-colors"
              aria-label="Next meeting"
              data-testid="switcher-next"
            >
              <CaretRight size={14} />
            </button>
          </div>
        </div>
      )}

      {many && (
        <div className="flex items-center gap-2 flex-wrap">
          {pending.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`text-xs px-2 py-1 cursor-pointer rounded-md border transition-colors ${
                i === index
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid={`switcher-chip-${i}`}
            >
              {fmtShort(p.startsAt)}
              {p.isLate && <span className="text-[#A4503C]"> · late</span>}
            </button>
          ))}
        </div>
      )}

      {/* Re-mount the form per meeting so each submission starts clean and carries the right id. */}
      <form action={action} className="space-y-6" key={current.id}>
        <input type="hidden" name="calendarEventId" value={current.id} />

        <div
          className={`p-3 rounded-md border text-sm ${current.isLate ? "bg-[#FDEBEC] border-[#A4503C]/20 text-[#A4503C]" : "bg-card border-border text-muted-foreground"}`}
          data-testid="status-meeting-notice"
        >
          For lead meeting <strong className="text-foreground">{current.title}</strong> on{" "}
          {fmt(current.startsAt)}
          {current.isLate && <> &middot; <strong>this submission will be marked late</strong></>}
        </div>

        {FIELDS.map(({ name, label, placeholder }) => (
          <div key={name}>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              {label} *
            </label>
            <textarea
              name={name}
              rows={3}
              required
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
            />
          </div>
        ))}

        {/* Help needed toggle */}
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <input type="checkbox" id="needsHelp" name="needsHelp" className="w-4 h-4 accent-primary" />
            <label htmlFor="needsHelp" className="text-sm font-medium text-foreground">
              I need help from the PM
            </label>
          </div>
          <textarea
            name="helpNeeded"
            rows={2}
            placeholder="Describe what help you need…"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton
            label="Submit Project Standing"
            pendingLabel="Submitting…"
            className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-muted-foreground clickable-icon"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
