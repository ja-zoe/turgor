"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { McpConnectionType } from "@/generated/prisma";

// The personal-access-token connection always keys to a single row (Postgres treats NULLs
// as distinct in a unique index, so we use a fixed sentinel clientId). See R18.1.
const PERSONAL_CLIENT_ID = "personal";

export async function generateMcpToken(): Promise<{ token: string }> {
  const user = await requireAuth();
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { mcpToken: token },
  });
  // Maintain the ACCESS_TOKEN connection so the status shows immediately, not just on
  // first use. A fresh/regenerated token resets createdAt + lastSeenAt to now.
  const now = new Date();
  await prisma.mcpConnection.upsert({
    where: {
      userId_type_clientId: {
        userId: user.id,
        type: McpConnectionType.ACCESS_TOKEN,
        clientId: PERSONAL_CLIENT_ID,
      },
    },
    create: {
      userId: user.id,
      type: McpConnectionType.ACCESS_TOKEN,
      clientId: PERSONAL_CLIENT_ID,
      label: "Personal access token",
    },
    update: { createdAt: now, lastSeenAt: now, label: "Personal access token" },
  });
  revalidatePath("/account");
  return { token };
}

export async function revokeMcpToken(): Promise<void> {
  const user = await requireAuth();
  await prisma.user.update({
    where: { id: user.id },
    data: { mcpToken: null },
  });
  // Drop the access-token connection so the status clears immediately on revoke.
  await prisma.mcpConnection.deleteMany({
    where: {
      userId: user.id,
      type: McpConnectionType.ACCESS_TOKEN,
      clientId: PERSONAL_CLIENT_ID,
    },
  });
  revalidatePath("/account");
}
