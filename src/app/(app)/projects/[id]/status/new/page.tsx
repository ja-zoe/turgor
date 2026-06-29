import { notFound, redirect } from "next/navigation";
import { requireAuth, getProjectMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { submitStatusUpdate } from "@/lib/actions/status-updates";
import { getPendingLeadMeetings } from "@/lib/lead-meeting";
import { StatusSubmitSwitcher } from "@/components/status-submit-switcher";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function SubmitStatusUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const membership = await getProjectMembership(user.id, id);
  if (!membership || membership.role === "MEMBER") redirect(`/projects/${id}`);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, semester: true },
  });
  if (!project) notFound();

  // All lead meetings this project currently owes a standing update for (R12.2). The
  // submitter picks which one in the switcher; submitting one returns here until none remain.
  const pending = await getPendingLeadMeetings(id);
  if (pending.length === 0) redirect(`/projects/${id}`); // nothing left to submit

  async function handleSubmit(formData: FormData) {
    "use server";
    await submitStatusUpdate(id, formData);
  }

  const pendingDTO = pending.map((p) => ({
    id: p.meeting.id,
    title: p.meeting.title,
    startsAt: p.meeting.startsAt.toISOString(),
    isLate: p.isLate,
  }));

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Project Standing
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          {project.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{project.semester}</p>
      </div>

      <StatusSubmitSwitcher projectId={id} pending={pendingDTO} action={handleSubmit} />
    </div>
  );
}
