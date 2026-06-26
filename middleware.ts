import NextAuth from "next-auth";
import authConfig from "./src/auth.config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

// Routes that don't require authentication
const PUBLIC_PATHS = ["/", "/dev-login", "/pending", "/cas", "/api/cas", "/api/auth", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth(function middleware(request: NextAuthRequest) {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (isPublic(pathname)) {
    // Redirect already-signed-in users away from the login page
    if (pathname === "/dev-login" && session?.user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Not signed in → CAS login
  if (!session?.user) {
    const url = new URL("/api/cas/login", request.url);
    url.searchParams.set("service", request.url);
    return NextResponse.redirect(url);
  }

  const status = session.user.status as string | undefined;

  if (status === "SUSPENDED") {
    return NextResponse.redirect(new URL("/dev-login?error=suspended", request.url));
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
