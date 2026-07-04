import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org";
import { isEmailDomainAllowed, isEmailTestCapture } from "@/lib/auth-provider";

const LINK_TTL_MS = 15 * 60_000;

/**
 * R28.1 — magic-link request. Stores a hashed single-use NextAuth VerificationToken
 * and emails the sign-in link. The response is identical whether the address is
 * valid, allowlisted, or known — no account enumeration. Browsers get a 303 back to
 * the form's "check your email" state; JSON callers get { ok: true } (plus the link
 * itself only under the dev-only test-capture hook).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = ((form?.get("email") as string | null) ?? "").trim().toLowerCase();
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  const neutral = (extra?: Record<string, string>) =>
    wantsJson
      ? NextResponse.json({ ok: true, ...extra })
      : NextResponse.redirect(new URL("/signin/email?sent=1", request.url), 303);

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!looksLikeEmail || !isEmailDomainAllowed(email)) return neutral();

  const raw = randomBytes(32).toString("hex");
  const hashed = createHash("sha256").update(raw).digest("hex");
  // One active link per address — a re-request invalidates earlier links.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token: hashed, expires: new Date(Date.now() + LINK_TTL_MS) },
  });

  const base = process.env.AUTH_URL ?? request.nextUrl.origin;
  const link = new URL("/api/auth/email/callback", base);
  link.searchParams.set("token", raw);
  link.searchParams.set("email", email);

  if (isEmailTestCapture()) return neutral({ link: link.toString() });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("magic-link sign-in needs RESEND_API_KEY to deliver links");
    return neutral();
  }
  const { appName } = await getOrgSettings();
  const from =
    process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? `${appName} <onboarding@resend.dev>`;
  const { Resend } = await import("resend");
  try {
    await new Resend(apiKey).emails.send({
      from,
      to: email,
      subject: `Sign in to ${appName}`,
      html:
        `<p>Click the link below to sign in to ${appName}:</p>` +
        `<p><a href="${link.toString()}">Sign in to ${appName}</a></p>` +
        `<p>The link expires in 15 minutes and works once. If you didn't request it, you can ignore this email.</p>`,
    });
  } catch (e) {
    console.error("magic-link send failed", e);
  }
  return neutral();
}
