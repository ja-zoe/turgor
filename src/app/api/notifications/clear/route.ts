import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Clear (hard-delete) the signed-in user's notifications. Mirrors the POST shape of
 * `read/route.ts`. With `{ id }` deletes that one notification; with an empty body
 * clears all of the user's notifications. Every delete is scoped to the session user,
 * so a user can only ever clear their own. (R20.1)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;

  if (id) {
    await prisma.notification.deleteMany({
      where: { id, userId: session.user.id },
    });
  } else {
    await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
