"use client";

import { useState, useTransition, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Plus, SortAscending, ArrowsDownUp, XCircle,
  PencilSimple, CalendarBlank, UserCircle, CheckFat, LockSimple,
} from "@phosphor-icons/react";
import {
  deleteSubtask,
  updateSubtaskStatus,
  updateSubtaskTitle,
  updateSubtaskAssignee,
  updateSubtaskDueDate,
  updateDeliverableStatus,
} from "@/lib/actions/deliverables";
import { getDisplayName } from "@/lib/utils";

type TimelineStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";

interface Member {
  id: string;
  firstName: string | null;
  nickname: string | null;
  name: string | null;
  email: string;
}

interface Subtask {
  id: string;
  title: string;
  status: TimelineStatus;
  assignee: Member | null;
  dueDate: string | null;
}

interface Deliverable {
  id: string;
  title: string;
  status: TimelineStatus;
  group: string | null;
  targetDate: string;
  startDate: string | null;
  completed: boolean;
  subtasks: Subtask[];
}

interface SortableDeliverablesProps {
  deliverables: Deliverable[];
  projectId: string;
  canManage: boolean;
  canEdit: boolean;
  userId: string;
  members: Member[];
  deleteDeliverableAction: (id: string) => Promise<void>;
}

const STATUS_ORDER: Record<TimelineStatus, number> = {
  BLOCKED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, COMPLETE: 3,
};

const STATUS_DOT: Record<TimelineStatus, string> = {
  COMPLETE: "bg-[#588157]",
  BLOCKED: "bg-[#A4503C]",
  IN_PROGRESS: "bg-[#1F6C9F]",
  NOT_STARTED: "bg-[#787774]",
};

const STATUS_DOT_COLOR: Record<TimelineStatus, string> = {
  COMPLETE: "#588157",
  BLOCKED: "#A4503C",
  IN_PROGRESS: "#1F6C9F",
  NOT_STARTED: "#787774",
};

const STATUS_BADGE: Record<TimelineStatus, { bg: string; text: string; label: string }> = {
  NOT_STARTED: { bg: "bg-muted", text: "text-muted-foreground", label: "Not Started" },
  IN_PROGRESS: { bg: "bg-[#E1F3FE]", text: "text-[#1F6C9F]", label: "In Progress" },
  BLOCKED: { bg: "bg-[#FDEBEC]", text: "text-[#A4503C]", label: "Blocked" },
  COMPLETE: { bg: "bg-[#EDF3EC]", text: "text-[#588157]", label: "Complete" },
};

const STATUS_LABELS: Record<TimelineStatus, string> = {
  NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked", COMPLETE: "Complete",
};

const ALL_STATUSES: TimelineStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Shared portal hook ───────────────────────────────────────────────────────

function useAnchorPos(anchorEl: HTMLElement | null) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY + 2, left: rect.left + window.scrollX });
  }, [anchorEl]);
  return pos;
}

function useOutsideClose(anchorEl: HTMLElement | null, onClose: () => void) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      function onDown(e: MouseEvent) {
        if (anchorEl?.contains(e.target as Node)) return;
        onClose();
      }
      function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onEsc);
      cleanup = () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onEsc);
      };
    }, 0);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [anchorEl, onClose]);
}

// ─── StatusDropdown — portal-based status list (replaces old StatusPopover) ──

function StatusDropdown({
  subtaskId, current, anchorEl, onSelect, onClose,
}: {
  subtaskId: string;
  current: TimelineStatus;
  anchorEl: HTMLElement | null;
  onSelect: (s: TimelineStatus) => void;
  onClose: () => void;
}) {
  const pos = useAnchorPos(anchorEl);
  useOutsideClose(anchorEl, onClose);
  if (!pos) return null;
  return createPortal(
    <div
      style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 9999, fontFamily: "var(--font-mono)" }}
      onMouseDown={(e) => e.stopPropagation()}
      className="min-w-[160px] bg-card border border-border rounded-lg shadow-md py-1 text-xs"
    >
      {ALL_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left ${
            s === current ? "text-primary font-medium" : "text-foreground"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_DOT_COLOR[s] }} />
          {STATUS_LABELS[s]}
          {s === current && <span className="ml-auto text-muted-foreground">✓</span>}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ─── StatusPill — colored pill that replaces the status dot ──────────────────

function StatusPill({
  subtaskId, status, pendingStatus, canEdit,
  onPick, onConfirm, onCancel, isTransitioning,
}: {
  subtaskId: string;
  status: TimelineStatus;
  pendingStatus: TimelineStatus | null;
  canEdit: boolean;
  onPick: (s: TimelineStatus) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isTransitioning: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);

  const confirming = pendingStatus !== null;
  const displayStatus = pendingStatus ?? status;
  const bg = STATUS_DOT_COLOR[displayStatus];
  const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-white leading-none flex-shrink-0 transition-colors";

  if (!canEdit) {
    return (
      <span className={base} style={{ backgroundColor: STATUS_DOT_COLOR[status] }}>
        {STATUS_LABELS[status]}
      </span>
    );
  }

  if (confirming) {
    return (
      <div className={`${base} cursor-default`} style={{ backgroundColor: bg }}>
        <span>{STATUS_LABELS[displayStatus]}</span>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isTransitioning}
          className="hover:opacity-80 disabled:opacity-40 transition-opacity"
          title="Confirm"
        >
          ✓
        </button>
        <span className="opacity-40 select-none">|</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isTransitioning}
          className="hover:opacity-80 disabled:opacity-40 transition-opacity"
          title="Cancel"
        >
          ✗
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className={`${base} hover:opacity-80`}
        style={{ backgroundColor: bg }}
        onClick={() => setDropdownOpen((o) => !o)}
        data-testid="status-pill"
      >
        {STATUS_LABELS[status]}
      </button>
      {dropdownOpen && (
        <StatusDropdown
          subtaskId={subtaskId}
          current={status}
          anchorEl={pillRef.current}
          onSelect={(s) => { setDropdownOpen(false); onPick(s); }}
          onClose={() => setDropdownOpen(false)}
        />
      )}
    </>
  );
}

// ─── DeliverableStatusPopover — portal-based (standalone deliverables) ────────

function DeliverableStatusPopover({
  deliverableId, current, onClose, anchorEl,
}: {
  deliverableId: string;
  current: TimelineStatus;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const [isPending, startTransition] = useTransition();
  const pos = useAnchorPos(anchorEl);
  useOutsideClose(anchorEl, onClose);
  if (!pos) return null;
  return createPortal(
    <div
      style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 9999, fontFamily: "var(--font-mono)" }}
      onMouseDown={(e) => e.stopPropagation()}
      className="min-w-[160px] bg-card border border-border rounded-lg shadow-md py-1 text-xs"
    >
      {ALL_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={isPending}
          onClick={() => {
            if (s === current) { onClose(); return; }
            startTransition(async () => { await updateDeliverableStatus(deliverableId, s); onClose(); });
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left disabled:opacity-50 ${s === current ? "text-primary font-medium" : "text-foreground"}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />
          {STATUS_LABELS[s]}
          {s === current && <span className="ml-auto text-muted-foreground">✓</span>}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ─── AssigneeSearch — portal-based picker ────────────────────────────────────

function AssigneeSearch({
  members, currentId, onSelect, onClose, anchorEl,
}: {
  members: Member[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useAnchorPos(anchorEl);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useOutsideClose(anchorEl, onClose);

  const filtered = members.filter((m) =>
    getDisplayName(m).toLowerCase().includes(query.toLowerCase())
  );

  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: "absolute", top: pos.top + 2, left: pos.left, zIndex: 9999, fontFamily: "var(--font-mono)" }}
      onMouseDown={(e) => e.stopPropagation()}
      className="w-52 bg-card border border-border rounded-lg shadow-md overflow-hidden"
      data-testid="assignee-picker"
    >
      <div className="p-1.5 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="w-full text-xs bg-transparent outline-none px-1 py-0.5 text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left text-xs ${!currentId ? "text-primary font-medium" : "text-muted-foreground"}`}
        >
          <UserCircle size={12} />
          None
          {!currentId && <span className="ml-auto">✓</span>}
        </button>
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left text-xs ${m.id === currentId ? "text-primary font-medium" : "text-foreground"}`}
          >
            <UserCircle size={12} />
            {getDisplayName(m)}
            {m.id === currentId && <span className="ml-auto">✓</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground">No members found</p>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SortableDeliverables({
  deliverables,
  projectId,
  canManage,
  canEdit,
  members = [],
  deleteDeliverableAction,
}: SortableDeliverablesProps) {
  const [sortByStatus, setSortByStatus] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Deliverable status popover (standalone deliverables only)
  const [deliverableStatusMenuFor, setDeliverableStatusMenuFor] = useState<string | null>(null);

  // Pending status-pill confirm (hoisted so other interactions can cancel it)
  const [pendingStatusEdit, setPendingStatusEdit] = useState<{
    subtaskId: string;
    status: TimelineStatus;
  } | null>(null);
  const [isStatusPending, startStatusTransition] = useTransition();

  // Pending field edits: title / assignee / dueDate
  const [pendingEdit, setPendingEdit] = useState<{
    subtaskId: string;
    field: "title" | "assignee" | "dueDate";
    value: string;
  } | null>(null);
  const [isPendingEdit, startEditTransition] = useTransition();
  // assigneePickerOpen is separate from pendingEdit so closing the picker
  // doesn't cancel the pending selection before ✓ is clicked
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  // Refs for portal anchor elements
  const deliverableDotRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const personRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  function startEdit(subtaskId: string, field: "title" | "assignee" | "dueDate", value: string) {
    setConfirmingDelete(null);
    setPendingStatusEdit(null);
    setAssigneePickerOpen(field === "assignee");
    setPendingEdit({ subtaskId, field, value });
    if (field === "title") setTimeout(() => titleInputRef.current?.select(), 0);
    if (field === "dueDate") setTimeout(() => dateInputRef.current?.focus(), 0);
  }

  function commitEdit() {
    if (!pendingEdit || isPendingEdit) return;
    const { subtaskId, field, value } = pendingEdit;
    setAssigneePickerOpen(false);
    setPendingEdit(null);
    startEditTransition(async () => {
      if (field === "title") await updateSubtaskTitle(subtaskId, value);
      else if (field === "assignee") await updateSubtaskAssignee(subtaskId, value || null);
      else if (field === "dueDate") await updateSubtaskDueDate(subtaskId, value || null);
    });
  }

  function cancelEdit() {
    setAssigneePickerOpen(false);
    setPendingEdit(null);
  }

  function confirmStatusEdit() {
    if (!pendingStatusEdit || isStatusPending) return;
    const { subtaskId, status } = pendingStatusEdit;
    setPendingStatusEdit(null);
    startStatusTransition(async () => { await updateSubtaskStatus(subtaskId, status); });
  }

  function cancelStatusEdit() {
    setPendingStatusEdit(null);
  }

  // ── Sort + group ───────────────────────────────────────────────────────────

  const sorted = sortByStatus
    ? [...deliverables].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    : deliverables;

  const useGroups = !sortByStatus && sorted.some((d) => d.group);

  let sections: { label: string | null; items: Deliverable[] }[] = [];
  if (useGroups) {
    const groupMap = new Map<string, Deliverable[]>();
    for (const d of sorted) {
      const key = d.group ?? "";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(d);
    }
    sections = Array.from(groupMap.entries()).map(([label, items]) => ({
      label: label || null,
      items,
    }));
  } else {
    sections = [{ label: null, items: sorted }];
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Sort toggle + add */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Deliverables</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortByStatus((s) => !s)}
            className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
              sortByStatus ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {sortByStatus ? <SortAscending size={12} /> : <ArrowsDownUp size={12} />}
            {sortByStatus ? "Sorted by status" : "Sort by status"}
          </button>
          {canManage && (
            <Link
              href={`/projects/${projectId}/deliverables/new`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <Plus size={12} />
              Add deliverable
            </Link>
          )}
        </div>
      </div>

      {deliverables.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl text-center">
          <p className="text-sm text-muted-foreground">No deliverables yet.</p>
          {canManage && (
            <Link
              href={`/projects/${projectId}/deliverables/new`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Plus size={14} />
              Add first deliverable
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(({ label, items }, si) => (
            <div key={si}>
              {label && (
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    {items.length}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {items.map((deliverable) => {
                  const badge = STATUS_BADGE[deliverable.status];
                  const isOverdue = !deliverable.completed && new Date(deliverable.targetDate) < new Date();
                  const hasSubtasks = deliverable.subtasks.length > 0;
                  const nonStartedSubtasks = deliverable.subtasks.filter(
                    (s) => s.status !== "NOT_STARTED"
                  );

                  return (
                    <div key={deliverable.id} className="border border-border rounded-xl overflow-hidden">
                      {/* Deliverable header */}
                      <div className="flex items-start justify-between gap-4 p-4 bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {deliverable.title}
                            </span>

                            {/* Deliverable status badge — 3 variants */}
                            {hasSubtasks ? (
                              <div className="relative group/badge">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full cursor-help ${badge.bg} ${badge.text}`}
                                >
                                  {badge.label}
                                  <LockSimple size={8} />
                                </span>
                                {nonStartedSubtasks.length > 0 && (
                                  <div className="absolute bottom-full left-0 mb-1.5 z-50 w-56 bg-foreground text-background rounded-md px-2.5 py-2 opacity-0 pointer-events-none group-hover/badge:opacity-100 transition-opacity duration-150">
                                    <p
                                      className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-background/70"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                      Driven by subtasks:
                                    </p>
                                    {nonStartedSubtasks.map((s) => (
                                      <p
                                        key={s.id}
                                        className="text-[11px] flex items-center gap-1.5 mb-0.5"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                      >
                                        <span
                                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block"
                                          style={{ backgroundColor: STATUS_DOT_COLOR[s.status] }}
                                        />
                                        {s.title} — {STATUS_LABELS[s.status]}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : canEdit ? (
                              <div className="relative">
                                <button
                                  ref={(el) => { deliverableDotRefs.current.set(deliverable.id, el); }}
                                  type="button"
                                  onClick={() =>
                                    setDeliverableStatusMenuFor(
                                      deliverableStatusMenuFor === deliverable.id ? null : deliverable.id
                                    )
                                  }
                                  className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full hover:opacity-80 transition-opacity cursor-pointer ${badge.bg} ${badge.text}`}
                                  title="Change status"
                                >
                                  {badge.label}
                                </button>
                                {deliverableStatusMenuFor === deliverable.id && (
                                  <DeliverableStatusPopover
                                    deliverableId={deliverable.id}
                                    current={deliverable.status}
                                    onClose={() => setDeliverableStatusMenuFor(null)}
                                    anchorEl={deliverableDotRefs.current.get(deliverable.id) ?? null}
                                  />
                                )}
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs text-muted-foreground mt-1"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            Target: {formatDate(deliverable.targetDate)}
                            {deliverable.startDate && <> &middot; Start: {formatDate(deliverable.startDate)}</>}
                            {isOverdue && <span className="text-[#A4503C] ml-2">overdue</span>}
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={`/projects/${projectId}/deliverables/${deliverable.id}/edit`}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              Edit
                            </Link>
                            <form action={async () => { await deleteDeliverableAction(deliverable.id); }}>
                              <button
                                type="submit"
                                className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        )}
                      </div>

                      {/* Subtask rows */}
                      {deliverable.subtasks.length > 0 && (
                        <div className="border-t border-border divide-y divide-border">
                          {deliverable.subtasks.map((subtask) => {
                            const isEditing = pendingEdit?.subtaskId === subtask.id;
                            const editField = isEditing ? pendingEdit!.field : null;
                            const pendingValue = isEditing ? pendingEdit!.value : "";

                            // What's shown as the assignee (pending or actual)
                            const displayAssigneeId = (isEditing && editField === "assignee")
                              ? (pendingValue || null)
                              : subtask.assignee?.id ?? null;
                            const displayAssignee = displayAssigneeId
                              ? (members.find((m) => m.id === displayAssigneeId) ?? subtask.assignee)
                              : null;

                            // What's shown as the due date (pending or actual)
                            const displayDueDate = (isEditing && editField === "dueDate")
                              ? pendingValue
                              : subtask.dueDate ?? "";

                            // Right-panel mode drives the slide animation
                            const rowMode = isEditing ? "edit"
                              : confirmingDelete === subtask.id ? "delete"
                              : "controls";

                            // Glow on hover or while actively editing this subtask
                            const isActive = isEditing || pendingStatusEdit?.subtaskId === subtask.id;
                            const dotColor = STATUS_DOT_COLOR[subtask.status];

                            return (
                              <div
                                key={subtask.id}
                                className="group/subtask flex items-center justify-between px-4 py-2.5 bg-background/50"
                                data-testid="subtask-row"
                              >
                                {/* ── Far-left status bullet (visual only, glows on hover/edit) ── */}
                                <span
                                  aria-hidden
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-2 transition-shadow duration-200 group-hover/subtask:shadow-[0_0_6px_2px_var(--dot)]"
                                  style={{
                                    backgroundColor: dotColor,
                                    ...({ "--dot": dotColor } as CSSProperties),
                                    ...(isActive ? { boxShadow: `0 0 6px 2px ${dotColor}` } : {}),
                                  }}
                                  data-testid="status-bullet"
                                />

                                {/* ── Left: title+pencil, status pill, assignee ── */}
                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">

                                  {/* Title + inline pencil */}
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    {canEdit && editField === "title" ? (
                                      <input
                                        ref={titleInputRef}
                                        className="text-xs text-foreground bg-transparent border-b border-primary outline-none min-w-0 flex-1 max-w-[200px] disabled:opacity-50"
                                        value={pendingValue}
                                        disabled={isPendingEdit}
                                        onChange={(e) =>
                                          setPendingEdit((p) => p ? { ...p, value: e.target.value } : p)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                      />
                                    ) : (
                                      <>
                                        <span className="text-xs text-foreground truncate">{subtask.title}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => startEdit(subtask.id, "title", subtask.title)}
                                            className="flex-shrink-0 opacity-0 group-hover/subtask:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                                            title="Edit title"
                                            data-testid="pencil-btn"
                                          >
                                            <PencilSimple size={11} />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {/* Status pill (replaces dot) */}
                                  <StatusPill
                                    subtaskId={subtask.id}
                                    status={subtask.status}
                                    pendingStatus={
                                      pendingStatusEdit?.subtaskId === subtask.id
                                        ? pendingStatusEdit.status
                                        : null
                                    }
                                    canEdit={canEdit}
                                    onPick={(s) => {
                                      setPendingStatusEdit({ subtaskId: subtask.id, status: s });
                                    }}
                                    onConfirm={confirmStatusEdit}
                                    onCancel={cancelStatusEdit}
                                    isTransitioning={isStatusPending}
                                  />

                                  {/* Assignee — wrapper div holds the stable portal anchor ref */}
                                  {(canEdit || displayAssignee) && (
                                    <div
                                      ref={(el) => { personRefs.current.set(subtask.id, el as HTMLButtonElement | null); }}
                                      className="relative flex-shrink-0"
                                    >
                                      {canEdit && editField === "assignee" ? (
                                        <span
                                          className="text-xs text-primary"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                          {displayAssignee ? getDisplayName(displayAssignee) : "None"}
                                        </span>
                                      ) : canEdit ? (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(subtask.id, "assignee", subtask.assignee?.id ?? "")}
                                          className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                          title="Change assignee"
                                        >
                                          {displayAssignee ? getDisplayName(displayAssignee) : <span className="opacity-50">Unassigned</span>}
                                        </button>
                                      ) : (
                                        <span
                                          className="text-xs text-muted-foreground"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                          {displayAssignee ? getDisplayName(displayAssignee) : null}
                                        </span>
                                      )}
                                      {assigneePickerOpen && (
                                        <AssigneeSearch
                                          members={members}
                                          currentId={displayAssigneeId}
                                          anchorEl={personRefs.current.get(subtask.id) ?? null}
                                          onSelect={(id) => {
                                            setPendingEdit((p) => p ? { ...p, value: id } : p);
                                            setAssigneePickerOpen(false);
                                          }}
                                          onClose={() => setAssigneePickerOpen(false)}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* ── Right: date + 3-panel controls ── */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Due date */}
                                  {canEdit && editField === "dueDate" ? (
                                    <input
                                      ref={dateInputRef}
                                      type="date"
                                      className="text-xs text-foreground bg-transparent border-b border-primary outline-none w-28 disabled:opacity-50"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                      value={pendingValue}
                                      disabled={isPendingEdit}
                                      onChange={(e) =>
                                        setPendingEdit((p) => p ? { ...p, value: e.target.value } : p)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                    />
                                  ) : displayDueDate ? (
                                    <span
                                      className="text-xs text-muted-foreground"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                      {formatDateShort(displayDueDate)}
                                    </span>
                                  ) : null}

                                  {/* Three-state slide panel */}
                                  {canManage && (
                                    <div className="relative flex items-center" style={{ minWidth: "60px" }}>

                                      {/* Panel A — controls: calendar + person + delete */}
                                      <div
                                        className={`flex items-center gap-1.5 transition-all duration-200 ${
                                          rowMode === "controls"
                                            ? "opacity-100 translate-x-0"
                                            : "opacity-0 pointer-events-none -translate-x-2"
                                        }`}
                                      >
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEdit(
                                                subtask.id,
                                                "dueDate",
                                                subtask.dueDate ? subtask.dueDate.split("T")[0] : ""
                                              )
                                            }
                                            className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/subtask:opacity-100"
                                            title="Edit due date"
                                          >
                                            <CalendarBlank size={12} />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setConfirmingDelete(subtask.id)}
                                          className="text-muted-foreground hover:text-[#A4503C] transition-colors opacity-0 group-hover/subtask:opacity-100"
                                          title="Delete subtask"
                                        >
                                          <XCircle size={13} weight="bold" />
                                        </button>
                                      </div>

                                      {/* Panel B — edit confirm: ✓ ✗ */}
                                      <div
                                        className={`absolute right-0 flex items-center gap-2 transition-all duration-200 ${
                                          rowMode === "edit"
                                            ? "opacity-100 translate-x-0"
                                            : "opacity-0 pointer-events-none translate-x-2"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={commitEdit}
                                          disabled={isPendingEdit}
                                          className="text-[#588157] hover:text-[#588157]/70 disabled:opacity-50 transition-colors"
                                          title="Save"
                                        >
                                          <CheckFat size={13} weight="fill" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEdit}
                                          disabled={isPendingEdit}
                                          className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                                          title="Cancel"
                                        >
                                          <XCircle size={13} weight="bold" />
                                        </button>
                                      </div>

                                      {/* Panel C — delete confirm */}
                                      <div
                                        className={`absolute right-0 flex items-center gap-2 transition-all duration-200 ${
                                          rowMode === "delete"
                                            ? "opacity-100 translate-x-0"
                                            : "opacity-0 pointer-events-none translate-x-2"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await deleteSubtask(subtask.id);
                                            setConfirmingDelete(null);
                                          }}
                                          className="text-xs text-[#A4503C] hover:text-[#A4503C]/70 transition-colors"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmingDelete(null)}
                                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                          No
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add subtask */}
                      {canManage && (
                        <div className="border-t border-border px-4 py-2">
                          <Link
                            href={`/projects/${projectId}/deliverables/${deliverable.id}/subtasks/new`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            <Plus size={10} />
                            Add subtask
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
