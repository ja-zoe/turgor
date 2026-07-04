import { NextRequest, NextResponse } from "next/server";

/**
 * Sign-in dispatcher. The Edge proxy redirects unauthenticated traffic here (it
 * can't read the DB); since R33.1 there is one sign-in surface, so this simply
 * forwards to `/signin/email`, preserving `?next=` (the originally-requested URL)
 * so the email page can round-trip it. Kept as a route because the proxy and e2e
 * reference `/signin`.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const url = new URL("/signin/email", request.url);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
