import { NextRequest, NextResponse } from "next/server";
import { resolveActiveOrg } from "@/lib/tenant";
import { forOrg } from "@/lib/tenant-db";

export async function POST(req: NextRequest) {
  const t = await resolveActiveOrg();
  if (!t) return new NextResponse("Unauthorized", { status: 401 });

  const db = forOrg(t.orgId);
  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;

  if (id) {
    await db.notification.updateMany({
      where: { id, userId: t.userId },
      data: { read: true },
    });
  } else {
    // Mark all unread as read
    await db.notification.updateMany({
      where: { userId: t.userId, read: false },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
