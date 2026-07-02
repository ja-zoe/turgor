import { getOrgSettings } from "@/lib/org";
import { LandingContent } from "@/components/landing-content";

export default async function LandingPage() {
  const org = await getOrgSettings();
  return <LandingContent org={org} />;
}
