"use client";

import { useState, useTransition } from "react";
import { Plus, Check, ArrowClockwise, PencilSimple, Trash } from "@phosphor-icons/react";
import { closeActionItem, reopenActionItem, updateActionItem, deleteActionItem } from "@/lib/actions/action-items";
import { ActionItemModal, type ActionItemAssignee } from "@/components/action-item-modal";
import { InlineConfirm } from "@/components/sortable-deliverables";

export interface ActionItemRowDTO {
  id: string;
  description: string;
  ownerId: string | null;
  ownerName: string | null;
  deadline: string | null; // ISO
  status: "OPEN" | "DONE";
  carriedOver: boolean;
}

type EditField = "description" | "owner" | "deadline" | null;

/** A single open action item with inline per-field editing (R13.4) + a full-edit modal. */
function ActionItemRow({
  projectId,
  item,
  assignees,
  canEdit,
  canClose,
  currentUserId,
}: {
  projectId: string;
  item: ActionItemRowDTO;
  assignees: ActionItemAssignee[];
  canEdit: boolean;
  canClose: boolean;
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<EditField>(null);
  const [descDraft, setDescDraft] = useState(item.description);
  const [ownerDraft, setOwnerDraft] = useState(item.ownerId ?? "");
  const [deadlineDraft, setDeadlineDraft] = useState(item.deadline ? item.deadline.slice(0, 10) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function open(field: Exclude<EditField, null>) {
    if (!canEdit) return;
    setDescDraft(item.description);
    setOwnerDraft(item.ownerId ?? "");
    setDeadlineDraft(item.deadline ? item.deadline.slice(0, 10) : "");
    setEditing(field);
  }
  function cancel() {
    setEditing(null);
  }
  function commit(overrides: { description?: string; ownerId?: string; deadline?: string }) {
    const fd = new FormData();
    fd.set("description", overrides.description ?? item.description);
    fd.set("ownerId", overrides.ownerId ?? item.ownerId ?? "");
    fd.set("deadline", overrides.deadline ?? (item.deadline ? item.deadline.slice(0, 10) : ""));
    startTransition(async () => {
      await updateActionItem(item.id, fd);
      setEditing(null);
    });
  }
  function commitDescription() {
    const trimmed = descDraft.trim();
    if (!trimmed) { cancel(); return; } // description is required — empty = cancel
    commit({ description: trimmed });
  }

  const close = () => startTransition(async () => { await closeActionItem(item.id); });
  const del = () => startTransition(async () => { await deleteActionItem(item.id); setConfirmingDelete(false); });

  const metaClass = "text-xs text-muted-foreground";
  const editableCls = canEdit ? "cursor-text hover:text-foreground transition-colors" : "";

  return (
    <div
      className="flex items-start justify-between gap-3 px-4 py-3 bg-card border border-border rounded-lg"
      data-testid="action-item-row"
    >
      <div className="flex-1 min-w-0">
        {/* Description — inline editable */}
        {editing === "description" ? (
          <span className="inline-flex items-center gap-1 w-full">
            <input
              autoFocus
              type="text"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitDescription(); }
                else if (e.key === "Escape") cancel();
              }}
              className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
              data-testid="action-item-desc-input"
            />
            <InlineConfirm show onConfirm={commitDescription} onCancel={cancel} disabled={isPending} />
          </span>
        ) : (
          <p
            className={`text-sm text-foreground ${editableCls}`}
            onClick={() => open("description")}
            data-testid="action-item-desc"
          >
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Owner — inline editable */}
          {editing === "owner" ? (
            <span className="inline-flex items-center gap-1">
              <select
                autoFocus
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(e.target.value)}
                className="text-xs cursor-pointer rounded border border-primary bg-card px-1 py-0.5 outline-none"
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="action-item-owner-select"
              >
                <option value="">No owner</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <InlineConfirm show onConfirm={() => commit({ ownerId: ownerDraft })} onCancel={cancel} disabled={isPending} />
            </span>
          ) : (
            <span
              className={`${metaClass} ${editableCls}`}
              style={{ fontFamily: "var(--font-mono)" }}
              onClick={() => open("owner")}
              data-testid="action-item-owner"
            >
              {item.ownerName ?? (canEdit ? "+ owner" : "")}
            </span>
          )}

          {/* Deadline — inline editable */}
          {editing === "deadline" ? (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                type="date"
                value={deadlineDraft}
                onChange={(e) => setDeadlineDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
                className="text-xs rounded border border-primary bg-card px-1 py-0.5 outline-none"
                style={{ fontFamily: "var(--font-mono)" }}
                data-testid="action-item-deadline-input"
              />
              <InlineConfirm show onConfirm={() => commit({ deadline: deadlineDraft })} onCancel={cancel} disabled={isPending} />
            </span>
          ) : (
            <span
              className={`text-xs ${item.deadline && new Date(item.deadline) < new Date() ? "text-[#A4503C]" : "text-muted-foreground"} ${editableCls}`}
              style={{ fontFamily: "var(--font-mono)" }}
              onClick={() => open("deadline")}
              data-testid="action-item-deadline"
            >
              {item.deadline
                ? `due ${new Date(item.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                : canEdit ? "+ due date" : ""}
            </span>
          )}

          {item.carriedOver && (
            <span
              className="text-xs text-[#C99846] bg-[#FBF3DB] px-1.5 py-0.5 rounded"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              carried over
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canEdit && (
          <ActionItemModal
            mode="edit"
            projectId={projectId}
            assignees={assignees}
            item={{ id: item.id, description: item.description, ownerId: item.ownerId, deadline: item.deadline }}
            trigger={
              <button
                type="button"
                title="Edit (full)"
                data-testid="action-item-edit"
                className="text-muted-foreground clickable-icon"
              >
                <PencilSimple size={12} />
              </button>
            }
          />
        )}
        {(canClose || item.ownerId === currentUserId) && (
          <button
            type="button"
            onClick={close}
            disabled={isPending}
            title="Mark done"
            className="cursor-pointer flex-shrink-0 w-6 h-6 rounded border border-border hover:border-[#588157] hover:bg-[#EDF3EC] transition-colors flex items-center justify-center text-muted-foreground hover:text-[#588157] disabled:opacity-50 disabled:cursor-default"
          >
            <Check size={12} />
          </button>
        )}
        {canEdit && (
          confirmingDelete ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid="action-item-delete-confirm"
            >
              <InlineConfirm
                show
                onConfirm={del}
                onCancel={() => setConfirmingDelete(false)}
                disabled={isPending}
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              title="Delete"
              data-testid="action-item-delete"
              className="text-muted-foreground clickable-danger disabled:opacity-50"
            >
              <Trash size={12} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** A single completed action item with re-open + delete (R18.3). */
function ClosedActionItemRow({
  item,
  canClose,
}: {
  item: ActionItemRowDTO;
  canClose: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const reopen = () => startTransition(async () => { await reopenActionItem(item.id); });
  const del = () => startTransition(async () => { await deleteActionItem(item.id); setConfirmingDelete(false); });

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card border border-border rounded-lg opacity-60"
      data-testid="action-item-done-row"
    >
      <p className="text-sm text-foreground line-through">{item.description}</p>
      {canClose && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={reopen}
            disabled={isPending}
            title="Re-open"
            className="text-muted-foreground clickable-icon disabled:opacity-50"
          >
            <ArrowClockwise size={12} />
          </button>
          {confirmingDelete ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid="action-item-delete-confirm"
            >
              <InlineConfirm
                show
                onConfirm={del}
                onCancel={() => setConfirmingDelete(false)}
                disabled={isPending}
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              title="Delete"
              data-testid="action-item-delete"
              className="text-muted-foreground clickable-danger disabled:opacity-50"
            >
              <Trash size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ActionItemsSection({
  projectId,
  items,
  assignees,
  canCreate,
  canClose,
  currentUserId,
}: {
  projectId: string;
  items: ActionItemRowDTO[];
  assignees: ActionItemAssignee[];
  canCreate: boolean;
  canClose: boolean;
  currentUserId: string;
}) {
  const openItems = items.filter((i) => i.status === "OPEN");
  const doneItems = items.filter((i) => i.status === "DONE");

  return (
    <div>
      {canCreate && (
        <div className="mb-4">
          <ActionItemModal
            mode="create"
            projectId={projectId}
            assignees={assignees}
            trigger={
              <button
                type="button"
                data-testid="action-item-new"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
              >
                <Plus size={14} /> New action item
              </button>
            }
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No action items yet.</p>
      ) : (
        <div className="space-y-2">
          {openItems.map((item) => (
            <ActionItemRow
              key={item.id}
              projectId={projectId}
              item={item}
              assignees={assignees}
              canEdit={canCreate}
              canClose={canClose}
              currentUserId={currentUserId}
            />
          ))}

          {doneItems.length > 0 && (
            <details className="mt-2">
              <summary
                className="cursor-pointer text-xs text-muted-foreground clickable-icon"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {doneItems.length} completed item{doneItems.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {doneItems.map((item) => (
                  <ClosedActionItemRow key={item.id} item={item} canClose={canClose} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
