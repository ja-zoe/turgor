// Used by the real CAS flow: the /cas/callback route redirects here with
// ?token=... after validating the CAS ticket. This page completes sign-in.
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function HandoffPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect("/dev-login?error=no_token");

  try {
    await signIn("credentials", { token, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/dev-login?error=${err.type}`);
    }
    throw err;
  }

  // Unreachable — signIn always redirects or throws
  return null;
}
