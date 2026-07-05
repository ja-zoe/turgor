import { NextResponse } from "next/server";
import { resolveActiveOrg } from "@/lib/tenant";
import { forOrg } from "@/lib/tenant-db";

export async function GET() {
  const t = await resolveActiveOrg();
  if (!t) return new NextResponse("Unauthorized", { status: 401 });

  const db = forOrg(t.orgId);
  const notifications = await db.notification.findMany({
    where: { userId: t.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ notifications, unreadCount });
}
