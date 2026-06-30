import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { updateProfile } from "@/lib/actions/profile";

export default async function ProfileSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/cas/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, email: true },
  });
  if (user?.firstName) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F1EA]">
      <div className="w-full max-w-md px-6 py-10 bg-white border border-[#D5CFC0] rounded-2xl">
        <p className="text-xs text-[#787774] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)" }}>
          SEED Project Tracker
        </p>
        <h1
          className="text-2xl text-[#2E4034] mb-2"
          style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}
        >
          Complete your profile
        </h1>
        <p className="text-sm text-[#787774] mb-8">
          This is a one-time setup. Your name is shown to project collaborators.
        </p>

        <form action={updateProfile} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#2E4034] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
              First name <span className="text-[#A4503C]">*</span>
            </label>
            <input
              name="firstName"
              required
              autoFocus
              className="w-full rounded-lg border border-[#D5CFC0] bg-[#F4F1EA] px-3 py-2.5 text-sm text-[#2E4034] placeholder:text-[#787774] focus:outline-none focus:ring-2 focus:ring-[#588157]/40"
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2E4034] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
              Last name <span className="text-[#A4503C]">*</span>
            </label>
            <input
              name="lastName"
              required
              className="w-full rounded-lg border border-[#D5CFC0] bg-[#F4F1EA] px-3 py-2.5 text-sm text-[#2E4034] placeholder:text-[#787774] focus:outline-none focus:ring-2 focus:ring-[#588157]/40"
              placeholder="Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2E4034] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
              Nickname <span className="text-[#787774]">(optional)</span>
            </label>
            <input
              name="nickname"
              className="w-full rounded-lg border border-[#D5CFC0] bg-[#F4F1EA] px-3 py-2.5 text-sm text-[#2E4034] placeholder:text-[#787774] focus:outline-none focus:ring-2 focus:ring-[#588157]/40"
              placeholder="Jay — shown as your display name"
            />
          </div>
          <button
            type="submit"
            className="w-full cursor-pointer rounded-lg bg-[#2E4034] text-white text-sm font-medium py-2.5 hover:bg-[#2E4034]/80 transition-colors"
          >
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}
