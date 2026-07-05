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
  // R35.4: the personal MCP token is bound to the org that was active when it was
  // generated — an MCP call has no session, so the token names the org it acts in.
  await prisma.user.update({
    where: { id: user.id },
    data: { mcpToken: token, mcpTokenOrgId: user.orgId },
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
      orgId: user.orgId,
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

export async function updateEmailNotifications(formData: FormData): Promise<void> {
  const user = await requireAuth();
  // Unchecked checkboxes drop out of FormData, so absence means opted out.
  const enabled = formData.get("emailNotifications") === "on";
  await prisma.user.update({
    where: { id: user.id },
    data: { emailNotifications: enabled },
  });
  revalidatePath("/account");
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
