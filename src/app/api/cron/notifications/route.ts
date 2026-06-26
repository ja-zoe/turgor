import { NextRequest, NextResponse } from "next/server";
import { runNotificationEngine } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fired, errors } = await runNotificationEngine();

  return NextResponse.json({
    ok: true,
    fired,
    errors: errors.length > 0 ? errors : undefined,
  });
}
