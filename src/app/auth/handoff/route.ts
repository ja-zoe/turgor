import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// Completes sign-in for every token-minting flow: the R28.1 email magic-link
// callback, the OAuth callbacks (R33.2), and the dev mock all redirect here with
// ?token=<handoff token>.
// This is a Route Handler, not a page — NextAuth's signIn writes session cookies,
// which Next 16 forbids during page render (the previous page.tsx version threw
// "Cookies can only be modified in a Server Action or Route Handler").
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) redirect("/dev-login?error=no_token");

  try {
    await signIn("credentials", { token, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/dev-login?error=${err.type}`);
    }
    throw err; // NEXT_REDIRECT from signIn's redirectTo
  }
  redirect("/dashboard");
}
