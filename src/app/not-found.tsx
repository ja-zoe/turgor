import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";

/**
 * Global 404 — rendered within the root layout (no app sidebar) for unknown top-level
 * routes and any `notFound()` outside the (app) group.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF3EC]">
          <Compass size={22} weight="fill" className="text-primary" />
        </div>
        <h1
          className="text-3xl text-foreground"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
        >
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
