import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { createMeetingRecord } from "@/lib/actions/meeting-records";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function NewMeetingRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission(Permission.POST_MEETING_TRACKING);

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      semester: true,
      status: true,
      statusUpdates: {
        orderBy: { meetingDate: "desc" },
        take: 1,
        select: { meetingDate: true },
      },
    },
  });
  if (!project) notFound();

  const todayStr = new Date().toISOString().split("T")[0];

  async function handleSubmit(formData: FormData) {
    "use server";
    await createMeetingRecord(id, formData);
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground clickable mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ArrowLeft size={12} />
          {project.name}
        </Link>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Post-Meeting
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Record Meeting
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{project.name}</p>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Meeting Date *
          </label>
          <input
            name="meetingDate"
            type="date"
            required
            defaultValue={todayStr}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Project Status *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["ON_TRACK", "AT_RISK", "BEHIND"] as const).map((s) => (
              <label
                key={s}
                className="flex items-center justify-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  defaultChecked={s === project.status}
                  required
                  className="sr-only"
                />
                <span className="text-xs font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {s === "ON_TRACK" ? "On Track" : s === "AT_RISK" ? "At Risk" : "Behind"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Weekly Goal Met *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([{ value: "true", label: "Yes" }, { value: "false", label: "No" }, { value: "null", label: "N/A" }] as const).map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center justify-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="goalMet"
                  value={value}
                  required
                  className="sr-only"
                />
                <span className="text-xs font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Key Blockers
          </label>
          <textarea
            name="keyBlockers"
            rows={2}
            placeholder="What is blocking this project right now?"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Any additional notes from the meeting…"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors"
          >
            Save Record
          </button>
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground clickable-icon"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
