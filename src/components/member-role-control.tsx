"use client";

import { useState, useTransition } from "react";
import { updateMemberRole } from "@/lib/actions/projects";
import { InlineConfirm } from "@/components/sortable-deliverables";

type ProjectMemberRole = "LEAD" | "SUBLEAD" | "MEMBER";

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "SUBLEAD", label: "Sub-lead" },
  { value: "MEMBER", label: "Member" },
];

const LABEL: Record<ProjectMemberRole, string> = {
  LEAD: "lead",
  SUBLEAD: "sublead",
  MEMBER: "member",
};

/**
 * Inline editor for a project member's role (R13.5). Click the role to reveal a select
 * + InlineConfirm ✓/✗ (same microinteraction as action items / deliverables). Gated by
 * MANAGE_PROJECTS server-side in `updateMemberRole`; the page only renders this for
 * users who can manage the project.
 */
export function MemberRoleControl({
  projectId,
  userId,
  role,
}: {
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectMemberRole>(role);
  const [isPending, startTransition] = useTransition();

  function open() {
    setDraft(role);
    setEditing(true);
  }
  function cancel() {
    setEditing(false);
  }
  function commit() {
    if (draft === role) { setEditing(false); return; } // no-op
    startTransition(async () => {
      await updateMemberRole(projectId, userId, draft);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <select
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value as ProjectMemberRole)}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          className="text-xs cursor-pointer rounded border border-primary bg-card px-1 py-0.5 outline-none"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="member-role-select"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <InlineConfirm show onConfirm={commit} onCancel={cancel} disabled={isPending} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="clickable"
      style={{ fontFamily: "var(--font-mono)" }}
      data-testid="member-role"
      title="Edit role"
    >
      {LABEL[role]}
    </button>
  );
}
