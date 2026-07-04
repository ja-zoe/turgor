import Image from "next/image";
import type { OrgSettings } from "@/lib/org";
import { TurgorMark } from "@/components/turgor-mark";

/**
 * The one way the app identifies itself, branching on org.isDefaultBrand (R32.2):
 * an unconfigured install gets the turgor treatment (drop mark + lowercase
 * Instrument Serif wordmark — the only place the lowercase rule applies); a
 * customized org gets its logo + resolved appFullName in the normal sans style.
 * Server-component-safe (no hooks beyond useId inside TurgorMark).
 */
export function BrandLockup({
  org,
  variant = "nav",
}: {
  org: OrgSettings;
  variant?: "nav" | "hero";
}) {
  const hero = variant === "hero";

  if (org.isDefaultBrand) {
    return (
      <span
        className={`inline-flex items-center text-foreground ${hero ? "gap-3" : "gap-2"}`}
      >
        <TurgorMark size={hero ? 52 : 20} />
        <span
          className={hero ? "text-5xl leading-none" : "text-base leading-none"}
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          turgor
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${hero ? "gap-3" : "gap-2"}`}>
      <Image
        src={org.orgLogoUrl}
        alt={org.orgName}
        width={hero ? 40 : 20}
        height={hero ? 40 : 20}
        unoptimized
        className="object-contain"
      />
      <span
        className={
          hero
            ? "text-3xl font-semibold tracking-tight text-foreground"
            : "text-sm font-semibold tracking-tight text-foreground"
        }
      >
        {org.appFullName}
      </span>
    </span>
  );
}
