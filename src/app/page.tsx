import { getOrgSettings } from "@/lib/org";
import { LandingContent } from "@/components/landing-content";

export default async function LandingPage() {
  const org = await getOrgSettings();
  // R33.1: one sign-in surface — always the email/OAuth page.
  return <LandingContent org={org} signInHref="/signin/email" />;
}
