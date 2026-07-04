import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { GsapProvider } from "@/components/gsap-provider";
import { getOrgSettings } from "@/lib/org";
import { readableForeground } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgSettings();
  return {
    title: org.appFullName,
    description: `Weekly accountability and ${org.periodLabelLower} progress tracking for ${org.orgName}.`,
    // R32.1: the favicon follows the org logo (Supabase Storage URL once uploaded);
    // the default is the Turgor drop mark. Keep src/app/icon.png deleted — the file
    // convention would override this.
    icons: { icon: org.orgLogoUrl },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const org = await getOrgSettings();
  // R29.2: "custom" overrides the same tokens the preset blocks override, plus the
  // two canvas tokens, inline on <html>. Foregrounds are derived, never hand-picked.
  // A "custom" preset without valid colors falls back to forest (no attr, no style).
  const custom = org.themePreset === "custom" ? org.customColors : null;
  const customStyle = custom
    ? ({
        "--primary": custom.primary,
        "--primary-foreground": readableForeground(custom.primary),
        "--ring": custom.primary,
        "--chart-2": custom.primary,
        "--sidebar-primary": custom.primary,
        "--sidebar-ring": custom.primary,
        "--accent": `color-mix(in srgb, ${custom.primary} 12%, white)`,
        "--sidebar-accent": `color-mix(in srgb, ${custom.primary} 12%, white)`,
        "--accent-foreground": custom.primary,
        "--sidebar-accent-foreground": custom.primary,
        "--background": custom.background,
        "--card": custom.card,
      } as React.CSSProperties)
    : undefined;
  const themeAttr =
    org.themePreset === "forest" || (org.themePreset === "custom" && !custom)
      ? undefined
      : org.themePreset;
  return (
    <html
      lang="en"
      data-theme={themeAttr}
      style={customStyle}
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GsapProvider>{children}</GsapProvider>
      </body>
    </html>
  );
}
