/**
 * Curated theme presets (R24.3). Each preset swaps only the hue-bearing tokens
 * (primary + its soft accent/focus variants) via a `[data-theme="…"]` block in
 * globals.css; canvas, card, borders, typography, and the semantic status colors
 * stay identical across presets. "forest" is the default and needs no CSS block —
 * a stock deployment renders pixel-identical to today.
 *
 * `primary` is duplicated here for non-CSS surfaces (settings swatches, the Excel
 * export header fill) — keep it in sync with the globals.css override blocks.
 */
export const THEME_PRESETS = [
  { id: "forest", label: "Forest", primary: "#2E4034" },
  { id: "slate", label: "Slate", primary: "#2E3A4E" },
  { id: "plum", label: "Plum", primary: "#45304C" },
  { id: "clay", label: "Clay", primary: "#7C452E" },
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];

export function isThemePresetId(value: string): value is ThemePresetId {
  return THEME_PRESETS.some((p) => p.id === value);
}

/** Primary hex for a preset id; unknown ids fall back to forest. */
export function themePrimaryHex(id: string): string {
  return (THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]).primary;
}

/* ─── Custom colors (R29.2) ──────────────────────────────────────────────────
   themePreset "custom" + Settings.customColors drive inline token overrides in
   the root layout. Deliberately three tokens only — primary, background, card —
   status colors and typography are semantic and stay fixed. */

export type CustomColors = { primary: string; background: string; card: string };

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isCustomColors(value: unknown): value is CustomColors {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (["primary", "background", "card"] as const).every(
    (k) => typeof v[k] === "string" && HEX_RE.test(v[k] as string)
  );
}

/** Stock canvas/card hexes (Forest Floor), used to seed the pickers. */
export const DEFAULT_CANVAS = "#F4F1EA";
export const DEFAULT_CARD = "#FFFFFF";

/**
 * Foreground for text sitting on `hex`: white on dark colors, near-black on
 * light ones, via WCAG relative luminance. Keeps a pale custom primary from
 * producing white-on-cream buttons.
 */
export function readableForeground(hex: string): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#1F231F" : "#FFFFFF";
}
