import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";

/**
 * In-shell 404 — the nearest not-found for `notFound()` calls inside the (app) group
 * (e.g. a missing project), so the sidebar/session chrome stays.
 */
export default function AppNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF3EC]">
          <Compass size={22} weight="fill" className="text-primary" />
        </div>
        <h1
          className="text-3xl text-foreground"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
        >
          Not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t find what you were looking for. It may have been removed or you don&apos;t have access.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
