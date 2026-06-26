import { NextRequest, NextResponse } from "next/server";
import { mintHandoffToken } from "@/lib/handoff-token";

// Receives the CAS redirect with ?ticket=ST-... and validates it.
// In real mode: makes a server-side call to CAS serviceValidate.
// In mock mode: the ticket is not used — dev-login signs in directly via server action.
export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  const service = request.nextUrl.searchParams.get("service") ??
    request.nextUrl.href.split("?")[0];

  if (process.env.CAS_MODE !== "real") {
    // Mock mode: should not normally reach here (dev-login handles auth directly).
    return NextResponse.redirect(new URL("/dev-login", request.url));
  }

  if (!ticket) {
    return NextResponse.redirect(new URL("/dev-login?error=no_ticket", request.url));
  }

  // Real CAS: validate the ticket server-side
  const validateUrl = new URL(`${process.env.CAS_BASE_URL}/serviceValidate`);
  validateUrl.searchParams.set("service", service);
  validateUrl.searchParams.set("ticket", ticket);

  let netId: string | null = null;
  try {
    const res = await fetch(validateUrl.toString());
    const xml = await res.text();
    const match = xml.match(/<cas:user>([^<]+)<\/cas:user>/);
    netId = match?.[1]?.trim() ?? null;
  } catch {
    return NextResponse.redirect(new URL("/dev-login?error=cas_unreachable", request.url));
  }

  if (!netId) {
    return NextResponse.redirect(new URL("/dev-login?error=invalid_ticket", request.url));
  }

  const token = mintHandoffToken(netId);
  const handoffUrl = new URL("/auth/handoff", request.url);
  handoffUrl.searchParams.set("token", token);
  return NextResponse.redirect(handoffUrl);
}
