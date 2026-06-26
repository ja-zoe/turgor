import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/generated/prisma";
import { createProject } from "@/lib/actions/projects";

export default async function NewProjectPage() {
  await requirePermission(Permission.MANAGE_PROJECTS);

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Projects
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          New Project
        </h1>
      </div>

      <form action={createProject} className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Project Name *
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Solar Panel Efficiency Study"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Semester *
          </label>
          <input
            name="semester"
            type="text"
            required
            placeholder="e.g. Fall 2026"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Brief description of the project goals…"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 transition-colors"
          >
            Create Project
          </button>
          <a
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
