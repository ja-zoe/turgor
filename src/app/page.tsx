import { getOrgSettings } from "@/lib/org";
import { getAuthProvider } from "@/lib/auth-provider";
import { LandingContent } from "@/components/landing-content";

export default async function LandingPage() {
  const org = await getOrgSettings();
  const provider = getAuthProvider();
  const signInHref = provider === "email" ? "/signin/email" : "/dev-login";
  const signInNote =
    provider === "cas" && process.env.CAS_MODE !== "real" ? "CAS mock mode active" : null;
  return <LandingContent org={org} signInHref={signInHref} signInNote={signInNote} />;
}
