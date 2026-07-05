import { Sparkle } from "@phosphor-icons/react/dist/ssr";

/**
 * Fallback shown where a premium section is gated off (R36.3). Presentational only, Forest
 * Floor tokens, no new deps. Renders solely when a provider gates the feature off — invisible
 * in the community (free) build.
 */
export function UpsellCard({
  feature,
  blurb,
}: {
  feature: string;
  blurb?: string;
}) {
  return (
    <div className="p-5 bg-card border border-dashed border-border rounded-xl flex items-start gap-3">
      <Sparkle size={18} weight="fill" className="text-[#C99846] flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{feature}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {blurb ?? "Available on paid plans."}
        </p>
      </div>
      <span
        className="ml-auto text-[10px] uppercase tracking-widest text-[#C99846] flex-shrink-0"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Upgrade
      </span>
    </div>
  );
}
