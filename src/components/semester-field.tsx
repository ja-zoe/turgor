"use client";

import { useState } from "react";

const NEW = "__new__";

const controlClass =
  "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

/**
 * Controlled semester picker: choose one of the existing semesters, or pick
 * "+ New semester…" to type a custom one. Keeps semester strings consistent across
 * projects (and lead meetings) so the Project Standing gating can match them exactly.
 */
export function SemesterField({
  value,
  onChange,
  options,
  testId,
  monoFont = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId?: string;
  monoFont?: boolean;
}) {
  const [mode, setMode] = useState<"select" | "new">(
    options.length === 0 || (value !== "" && !options.includes(value)) ? "new" : "select"
  );
  const font = monoFont ? { fontFamily: "var(--font-mono)" } : undefined;

  if (mode === "new") {
    return (
      <div className="space-y-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Fall 2026"
          className={controlClass}
          style={font}
          data-testid={testId}
          autoFocus
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMode("select");
              onChange(options[0]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            style={font}
          >
            ← Choose an existing semester
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={options.includes(value) ? value : ""}
      onChange={(e) => {
        if (e.target.value === NEW) {
          setMode("new");
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={controlClass}
      style={font}
      data-testid={testId}
    >
      {!options.includes(value) && <option value="" disabled>Select a semester…</option>}
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value={NEW}>+ New semester…</option>
    </select>
  );
}

/**
 * Form-friendly wrapper: holds its own state and emits a hidden `<input name>` so it
 * drops into a plain server-action `<form>` (e.g. the New Project page).
 */
export function SemesterFormField({
  name,
  defaultValue = "",
  options,
  testId,
}: {
  name: string;
  defaultValue?: string;
  options: string[];
  testId?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SemesterField value={value} onChange={setValue} options={options} testId={testId} />
    </>
  );
}
