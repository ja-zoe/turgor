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
