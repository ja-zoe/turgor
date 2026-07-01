"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
const labelClass =
  "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2";

/**
 * Linked Start/Target date inputs for the "Add Deliverable" form. Mirrors the edit
 * DeliverableModal: the start input can't exceed the target and the target can't precede
 * the start, so a lead can't create an inverted (start-after-target) deliverable — which
 * would otherwise render as a bare milestone in the Gantt and skew the Excel export.
 */
export function DeliverableDateFields() {
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
          Start Date
        </label>
        <input
          name="startDate"
          type="date"
          value={startDate}
          max={targetDate || undefined}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </div>
      <div>
        <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
          Target Date *
        </label>
        <input
          name="targetDate"
          type="date"
          required
          value={targetDate}
          min={startDate || undefined}
          onChange={(e) => setTargetDate(e.target.value)}
          className={inputClass}
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </div>
    </div>
  );
}
