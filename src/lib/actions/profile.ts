"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Self-service profile save from the /account settings page. Same fields as the
 * first-run setup, but revalidates in place instead of redirecting to /dashboard.
 */
export async function saveProfile(formData: FormData) {
  const user = await requireAuth();

  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const nickname = (formData.get("nickname") as string | null)?.trim() || null;

  if (!firstName || !lastName) throw new Error("First and last name are required");

  await prisma.user.update({
    where: { id: user.id },
    data: { firstName, lastName, nickname, name: `${firstName} ${lastName}` },
  });

  revalidatePath("/account");
}

export async function updateProfile(formData: FormData) {
  const user = await requireAuth();

  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const nickname = (formData.get("nickname") as string | null)?.trim() || null;

  if (!firstName || !lastName) throw new Error("First and last name are required");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      nickname,
      name: `${firstName} ${lastName}`,
    },
  });

  redirect("/dashboard");
}
