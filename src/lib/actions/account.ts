"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function generateMcpToken(): Promise<{ token: string }> {
  const user = await requireAuth();
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { mcpToken: token },
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
  revalidatePath("/account");
}
