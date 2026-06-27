import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDisplayName(user: {
  firstName?: string | null;
  nickname?: string | null;
  name?: string | null;
  email: string;
}): string {
  return user.nickname ?? user.firstName ?? user.name ?? user.email.split("@")[0];
}
