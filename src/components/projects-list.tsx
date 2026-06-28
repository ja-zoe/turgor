"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Plant, CheckSquare, Square } from "@phosphor-icons/react";
import { ProjectStatusBadge } from "@/components/status-badge";
import { deleteProjects } from "@/lib/actions/projects";
import type { ProjectStatus } from "@/generated/prisma";

export interface ProjectCard {
  id: string;
  name: string;
  description: string | null;
  semester: string;
  status: ProjectStatus;
  _count: { deliverables: number; assignments: number };
}

function CardBody({ project }: { project: ProjectCard }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Plant size={16} className="text-primary mt-0.5" weight="fill" />
        <div>
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {project.name}
          </p>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project.description}
            </p>
          )}
          <p
            className="text-xs text-muted-foreground mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {project.semester} &middot; {project._count.deliverables} deliverable
            {project._count.deliverables !== 1 ? "s" : ""} &middot;{" "}
            {project._count.assignments} member
            {project._count.assignments !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ProjectStatusBadge status={project.status} />
        <ArrowRight
          size={14}
          className="text-muted-foreground group-hover:text-foreground transition-colors"
        />
      </div>
    </div>
  );
}

export function ProjectsList({
  projects,
  canManage,
}: {
  projects: ProjectCard[];
  canManage: boolean;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
  }

  function doDelete() {
    const ids = [...selected];
    startTransition(async () => {
      await deleteProjects(ids);
      exitSelect();
    });
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex items-center justify-end h-6">
          {!selecting ? (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              data-testid="select-toggle"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Select
            </button>
          ) : (
            <button
              type="button"
              onClick={exitSelect}
              data-testid="select-cancel"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {projects.map((project) => {
          const isSel = selected.has(project.id);
          if (selecting) {
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => toggle(project.id)}
                data-testid="project-card"
                data-selected={isSel ? "true" : undefined}
                className={`group p-5 bg-card border rounded-xl text-left transition-colors ${
                  isSel ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-primary flex-shrink-0">
                    {isSel ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <CardBody project={project} />
                  </div>
                </div>
              </button>
            );
          }
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
            >
              <CardBody project={project} />
            </Link>
          );
        })}
      </div>

      {/* Sticky bulk-action bar */}
      {selecting && selected.size > 0 && (
        <div
          className="sticky bottom-4 z-10 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl"
          data-testid="bulk-action-bar"
        >
          <span className="text-sm font-medium" data-testid="selected-count">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              data-testid="bulk-delete"
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-[#A4503C] text-white hover:bg-[#A4503C]/85 transition-colors"
            >
              Delete
            </button>
          ) : (
            <>
              <span className="text-sm">Delete {selected.size}?</span>
              <button
                type="button"
                onClick={doDelete}
                disabled={isPending}
                data-testid="bulk-delete-confirm"
                className="text-sm font-medium px-3 py-1.5 rounded-md bg-[#A4503C] text-white hover:bg-[#A4503C]/85 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="text-sm text-background/80 hover:text-background transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
