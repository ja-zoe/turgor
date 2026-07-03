import { NextRequest, NextResponse } from "next/server";
import { getAuthProvider } from "@/lib/auth-provider";

/**
 * R29.4 — sign-in dispatcher. The Edge proxy can't read the database, so its
 * unauthenticated redirect targets this static route; here (Node runtime) the
 * org's configured provider is resolved and the request forwarded. `?next=` is
 * the originally-requested URL, propagated to CAS as its `service` param.
 */
export async function GET(request: NextRequest) {
  const provider = await getAuthProvider();
  const next = request.nextUrl.searchParams.get("next");

  if (provider === "email") {
    return NextResponse.redirect(new URL("/signin/email", request.url));
  }
  const url = new URL("/api/cas/login", request.url);
  url.searchParams.set("service", next ?? new URL("/dashboard", request.url).toString());
  return NextResponse.redirect(url);
}
