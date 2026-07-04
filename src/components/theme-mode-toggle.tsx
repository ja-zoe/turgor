"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";

/**
 * Per-user light/dark switch (R32.4). Mode lives in the `turgor-theme-mode` cookie
 * (1yr, Lax) and as `data-mode` on <html>; there is no DB column, so it works
 * signed-out and cross-tab-locally. Clicking flips both instantly — no server
 * round-trip, no revalidation. The root-layout inline script sets `data-mode`
 * before paint, so on mount we read the real mode from the DOM. Initial render is
 * mode-agnostic (shows the light-mode icon) so server and client hydration match.
 */
export function ThemeModeToggle() {
  const [mode, setMode] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setMode(document.documentElement.dataset.mode === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.mode = next;
    document.cookie = `turgor-theme-mode=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setMode(next);
  }

  const isDark = mode === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className="clickable-icon p-2 rounded-md text-muted-foreground"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  );
}
