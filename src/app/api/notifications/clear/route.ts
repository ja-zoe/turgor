import { NextRequest, NextResponse } from "next/server";
import { resolveActiveOrg } from "@/lib/tenant";
import { forOrg } from "@/lib/tenant-db";

/**
 * Clear (hard-delete) the signed-in user's notifications in the active org. Mirrors
 * the POST shape of `read/route.ts`. With `{ id }` deletes that one notification;
 * with an empty body clears all of the user's notifications in this org. Every
 * delete is scoped to the session user + active org, so a user can only ever clear
 * their own. (R20.1, org-scoped R35)
 */
export async function POST(req: NextRequest) {
  const t = await resolveActiveOrg();
  if (!t) return new NextResponse("Unauthorized", { status: 401 });

  const db = forOrg(t.orgId);
  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;

  if (id) {
    await db.notification.deleteMany({
      where: { id, userId: t.userId },
    });
  } else {
    await db.notification.deleteMany({
      where: { userId: t.userId },
    });
  }

  return NextResponse.json({ ok: true });
}
