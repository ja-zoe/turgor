import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { GsapProvider } from "@/components/gsap-provider";
import { getOrgSettings } from "@/lib/org";
import "./globals.css";

// R32.4: applied in <head> before paint. The mode cookie is server-rendered onto
// <html> when present (no flash for returning users); this only fills the no-cookie
// case from the OS preference so a first-time dark-OS visitor never flashes light.
const THEME_INIT = `(function(){try{var d=document.documentElement;if(!d.dataset.mode){var m=document.cookie.match(/(?:^|; )turgor-theme-mode=(light|dark)/);d.dataset.mode=m?m[1]:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}}catch(e){}})();`;

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
  // R32.4: family is org-wide (data-theme); mode is the per-user cookie (data-mode).
  // "forest" needs no data-theme (its light palette is :root). Mode is rendered from
  // the cookie when present so returning users get no flash; the no-cookie case is
  // filled pre-paint by THEME_INIT from the OS preference. suppressHydrationWarning
  // because that script mutates <html> before React hydrates.
  const themeAttr = org.themePreset === "forest" ? undefined : org.themePreset;
  const modeCookie = (await cookies()).get("turgor-theme-mode")?.value;
  const dataMode =
    modeCookie === "dark" || modeCookie === "light" ? modeCookie : undefined;
  return (
    <html
      lang="en"
      data-theme={themeAttr}
      data-mode={dataMode}
      suppressHydrationWarning
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <GsapProvider>{children}</GsapProvider>
      </body>
    </html>
  );
}
