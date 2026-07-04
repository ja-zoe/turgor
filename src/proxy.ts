import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

// Routes that don't require authentication.
// `/api/mcp` does its own Bearer-token auth and must return its 401 + WWW-Authenticate (not
// a CAS redirect) so OAuth/MCP clients (ChatGPT) can discover the auth server. `/.well-known`
// (OAuth protected-resource metadata + JWKS) must be world-readable for discovery.
const PUBLIC_PATHS = [
  "/",
  "/dev-login",
  "/signin",
  "/pending",
  "/api/auth",
  "/auth",
  "/api/mcp",
  "/.well-known",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth(function middleware(request: NextAuthRequest) {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (isPublic(pathname)) {
    // Note: /dev-login stays reachable while signed in — the CAS mock doubles as
    // the identity switcher (sign in as someone else replaces the session), and a
    // PENDING user whose approval landed mid-session re-logs in through it. The
    // page itself locks down outside mock mode (assertMockCas, R28.2).
    return NextResponse.next();
  }

  // Not signed in → the /signin dispatcher (R29.4). The provider now lives in
  // Settings and this proxy runs on the Edge runtime with no DB access, so the
  // Node-side dispatcher resolves cas-vs-email and forwards.
  if (!session?.user) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", request.url);
    return NextResponse.redirect(url);
  }

  const status = session.user.status as string | undefined;

  if (status === "SUSPENDED") {
    return NextResponse.redirect(new URL("/signin?error=suspended", request.url));
  }

  if (status === "PENDING") {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
