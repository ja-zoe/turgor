import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mintHandoffToken } from "@/lib/handoff-token";

/**
 * R28.1 — magic-link callback. Consumes the VerificationToken single-use, then
 * mints the standard 60s handoff token (full email as the identity) and hands into
 * the existing NextAuth Credentials sign-in via /auth/handoff, so user creation,
 * PENDING, and PM promotion run unchanged.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("token") ?? "";
  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const fail = () =>
    NextResponse.redirect(new URL("/signin/email?error=invalid_link", request.url));

  if (!raw || !email) return fail();

  const hashed = createHash("sha256").update(raw).digest("hex");
  const where = { identifier_token: { identifier: email, token: hashed } };
  const row = await prisma.verificationToken.findUnique({ where });
  if (!row) return fail();
  // Delete before judging expiry: the token is spent either way (single-use).
  await prisma.verificationToken.delete({ where });
  if (row.expires < new Date()) return fail();

  const handoffUrl = new URL("/auth/handoff", request.url);
  handoffUrl.searchParams.set("token", mintHandoffToken(email));
  return NextResponse.redirect(handoffUrl);
}
