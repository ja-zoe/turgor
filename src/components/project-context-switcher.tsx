"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretUpDown } from "@phosphor-icons/react";

type SwitcherProject = { id: string; name: string; semester: string; archived: boolean };

/**
 * R30.1 — the "{Project Name} <suffix>" heading whose project name doubles as a
 * searchable project switcher. Picking a project navigates to the same sub-page
 * (`/projects/<id>/<subPath>`). Combobox interaction follows the R9.3 idiom:
 * filter-as-you-type, ArrowUp/Down + Enter, Escape closes.
 */
export function ProjectContextSwitcher({
  current,
  projects,
  subPath,
  suffix,
}: {
  current: { id: string; name: string };
  projects: SwitcherProject[];
  subPath: string;
  suffix: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = projects.filter((p) => p.id !== current.id);
    if (!q) return pool.slice(0, 8);
    return pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [projects, query, current.id]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function go(projectId: string) {
    setOpen(false);
    setQuery("");
    router.push(`/projects/${projectId}/${subPath}`);
  }

  return (
    <div ref={rootRef} className="relative inline-block" data-testid="project-switcher">
      <h1
        className="text-3xl text-foreground"
        style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="clickable inline-flex items-baseline gap-1.5 cursor-pointer"
          data-testid="project-switcher-trigger"
        >
          {current.name}
          <CaretUpDown size={18} className="text-muted-foreground self-center" weight="bold" />
        </button>{" "}
        {suffix}
      </h1>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-30 w-80 rounded-xl border border-border bg-card shadow-sm p-2"
          data-testid="project-switcher-panel"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, matches.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              }
              if (e.key === "Enter" && matches[highlight]) {
                e.preventDefault();
                go(matches[highlight].id);
              }
            }}
            placeholder="Switch project…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="project-switcher-search"
          />
          <ul className="mt-1.5 max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching projects.</li>
            ) : (
              matches.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => go(p.id)}
                    className={`w-full text-left rounded-md px-3 py-2 cursor-pointer transition-colors ${
                      i === highlight ? "bg-muted" : "hover:bg-muted"
                    }`}
                    data-testid="project-switcher-option"
                  >
                    <span className="block text-sm text-foreground">{p.name}</span>
                    <span
                      className="block text-xs text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {p.semester}
                      {p.archived ? " · archived" : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
