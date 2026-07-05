import "server-only";

/**
 * Build an org's subdomain URL from the current request host (R39.3). Only meaningful on
 * Turgor Cloud (subdomain routing); self-host never calls this. Keeps the base domain + port,
 * swaps in the org slug as the left-most label. Base ∈ turgor.io / lvh.me / *.localhost.
 */
const BASE_DOMAINS = ["turgor.io", "lvh.me", "localhost"];

export function cloudOrgUrl(slug: string, host: string): string {
  const hostname = host.split(":")[0];
  const port = host.split(":")[1];
  const base = BASE_DOMAINS.find((b) => hostname === b || hostname.endsWith("." + b)) ?? hostname;
  const proto = base === "turgor.io" ? "https" : "http";
  return `${proto}://${slug}.${base}${port ? ":" + port : ""}`;
}
