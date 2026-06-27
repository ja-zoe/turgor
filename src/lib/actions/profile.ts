"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { redirect } from "next/navigation";

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
