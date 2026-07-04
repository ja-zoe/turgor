/**
 * Curated theme families (R24.3, expanded R32.4). The org picks one family
 * (`Settings.themePreset`); each renders as a full-token palette with a light and
 * a dark block in globals.css (dark is the per-user mode cookie, see layout.tsx).
 * "forest" is the default and its light block is `:root` — a stock deployment in
 * light mode is pixel-identical to before. The R29.2 "custom" picker was removed
 * in R32.4; a legacy stored "custom" value normalizes to forest on read.
 *
 * `primary` is the light-mode primary hex, duplicated here for non-CSS surfaces
 * (settings swatches, the Excel export header fill) — keep it in sync with each
 * family's light block in globals.css.
 */
export const THEME_PRESETS = [
  { id: "forest", label: "Forest", primary: "#2E4034" },
  { id: "slate", label: "Slate", primary: "#2E3A4E" },
  { id: "plum", label: "Plum", primary: "#45304C" },
  { id: "clay", label: "Clay", primary: "#7C452E" },
  { id: "marine", label: "Marine", primary: "#28454E" },
  { id: "ochre", label: "Ochre", primary: "#6E5623" },
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];

export function isThemePresetId(value: string): value is ThemePresetId {
  return THEME_PRESETS.some((p) => p.id === value);
}

/** Primary hex for a family id; unknown/legacy ids fall back to forest. */
export function themePrimaryHex(id: string): string {
  return (THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]).primary;
}
