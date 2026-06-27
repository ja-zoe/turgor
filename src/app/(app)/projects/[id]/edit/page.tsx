import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { updateProject } from "@/lib/actions/projects";
import { SubmitButton } from "@/components/submit-button";
import { DeleteProjectButton } from "./delete-project-button";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission(Permission.MANAGE_PROJECTS);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const startStr = project.startDate?.toISOString().split("T")[0] ?? "";
  const endStr = project.endDate?.toISOString().split("T")[0] ?? "";

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
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Edit Project
        </h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateProject(id, formData);
        }}
        className="space-y-6"
      >
        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Name *
          </label>
          <input
            name="name"
            type="text"
            required
            defaultValue={project.name}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Semester *
          </label>
          <input
            name="semester"
            type="text"
            required
            defaultValue={project.semester}
            placeholder="e.g. Fall 2026"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Start Date
            </label>
            <input
              name="startDate"
              type="date"
              defaultValue={startStr}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              End Date
            </label>
            <input
              name="endDate"
              type="date"
              defaultValue={endStr}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Description
          </label>
          <textarea
            name="description"
            rows={4}
            defaultValue={project.description ?? ""}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Corrective Action Plan
          </label>
          <textarea
            name="correctiveActionPlan"
            rows={3}
            defaultValue={project.correctiveActionPlan ?? ""}
            placeholder="Required when project is Behind…"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton
            label="Save Changes"
            pendingLabel="Saving…"
            className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Danger zone */}
      <div className="mt-12 pt-6 border-t border-border">
        <p
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Danger Zone
        </p>
        <DeleteProjectButton projectId={id} projectName={project.name} />
      </div>
    </div>
  );
}
