import { NextRequest, NextResponse } from "next/server";

// Redirects the browser to the CAS server (real mode) or the mock login screen.
export async function GET(request: NextRequest) {
  const base = process.env.AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const service = request.nextUrl.searchParams.get("service") ??
    `${base}/cas/callback`;

  if (process.env.CAS_MODE !== "real") {
    // Mock: send the user to our local dev-login screen
    const url = new URL("/dev-login", request.url);
    url.searchParams.set("service", service);
    return NextResponse.redirect(url);
  }

  const casUrl = new URL(`${process.env.CAS_BASE_URL}/login`);
  casUrl.searchParams.set("service", service);
  return NextResponse.redirect(casUrl);
}
