"use client";

import { useState, useTransition, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Plus, SortAscending, ArrowsDownUp, XCircle,
  PencilSimple, CalendarBlank, UserCircle, CheckFat, LockSimple, NotePencil,
  CaretUp, CaretDown,
} from "@phosphor-icons/react";
import { SubtaskModal } from "@/components/subtask-modal";
import { DeliverableModal } from "@/components/deliverable-modal";
import { MarkdownView } from "@/components/markdown-view";
import { MarkdownEditor } from "@/components/markdown-editor";
import {
  deleteSubtask,
  updateSubtaskStatus,
  updateSubtaskTitle,
  updateSubtaskAssignee,
  updateSubtaskDueDate,
  updateSubtaskDescription,
  updateDeliverableStatus,
  updateDeliverableTitle,
  updateDeliverableDates,
  updateDeliverableGroup,
  updateDeliverableDescription,
  updateDeliverablePriority,
  moveDeliverable,
} from "@/lib/actions/deliverables";
import { getDisplayName } from "@/lib/utils";
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";

type TimelineStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
type DeliverablePriority = "LOW" | "MEDIUM" | "HIGH";

const PRIORITY_ORDER: Record<DeliverablePriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const PRIORITY_META: Record<DeliverablePriority, { label: string; cls: string }> = {
  HIGH: { label: "High", cls: "bg-[#FDEBEC] text-[#A4503C]" },
  MEDIUM: { label: "Med", cls: "bg-[#FBF3DB] text-[#C99846]" },
  LOW: { label: "Low", cls: "bg-muted text-muted-foreground" },
};
const ALL_PRIORITIES: DeliverablePriority[] = ["HIGH", "MEDIUM", "LOW"];

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
  description: string | null;
  status: TimelineStatus;
  assignee: Member | null;
  dueDate: string | null;
}

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  status: TimelineStatus;
  priority: DeliverablePriority;
  group: string | null;
  orderIndex: number;
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

const LOCK_REASON: Record<TimelineStatus, string> = {
  BLOCKED:     "Status is locked because a subtask is blocked.",
  IN_PROGRESS: "Status is locked because a subtask is in progress.",
  COMPLETE:    "Status is locked because all subtasks are complete.",
  NOT_STARTED: "Status is locked — it follows subtask progress.",
};

// Deliverable/subtask dates are date-only (UTC midnight from `type="date"` inputs);
// format in UTC so they don't shift a day for sub-UTC viewers (US Eastern).
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Like formatDateShort, but includes the year when it isn't the current year.
function formatDueDate(iso: string) {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    d.getUTCFullYear() === new Date().getUTCFullYear()
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  return d.toLocaleDateString("en-US", opts);
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
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

// ─── InlineConfirm — animated ✓/✗ controls, shared across pill and field edits ─

export function InlineConfirm({
  show, onConfirm, onCancel, disabled, tone = "default",
}: {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  /** "onColor" renders white icons for use inside a solid-colored pill (e.g. the
   *  COMPLETE status pill, where the default green ✓ would be invisible). */
  tone?: "default" | "onColor";
}) {
  const confirmClass =
    tone === "onColor"
      ? "text-white hover:opacity-70 disabled:opacity-40 transition-opacity px-0.5"
      : "text-[#588157] hover:opacity-70 disabled:opacity-40 transition-opacity px-0.5";
  const cancelClass =
    tone === "onColor"
      ? "text-white/90 hover:opacity-70 disabled:opacity-40 transition-opacity px-0.5"
      : "hover:opacity-70 disabled:opacity-40 transition-opacity px-0.5";
  return (
    <span
      className={[
        "pill-confirm-slide inline-flex items-center gap-0.5 overflow-hidden",
        "transition-all duration-150 ease-out",
        show ? "max-w-[44px] opacity-100" : "max-w-0 opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!show}
    >
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={confirmClass}
        title="Confirm"
        tabIndex={show ? 0 : -1}
      >
        <CheckFat size={13} weight="fill" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className={cancelClass}
        title="Cancel"
        tabIndex={show ? 0 : -1}
      >
        <XCircle size={13} weight="bold" />
      </button>
    </span>
  );
}

// ─── StatusPill — uses InlineConfirm with animated label crossfade ────────────

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
  const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-white leading-none flex-shrink-0";

  if (!canEdit) {
    return (
      <span className={base} style={{ backgroundColor: STATUS_DOT_COLOR[status], transition: "background-color 150ms ease-out" }}>
        {STATUS_LABELS[status]}
      </span>
    );
  }

  // Always-mounted pill container: label + animated InlineConfirm
  return (
    <>
      <div
        className={`${base} cursor-default`}
        style={{ backgroundColor: bg, transition: "background-color 150ms ease-out" }}
        data-testid="status-pill-container"
      >
        {/* Label button — idle: clickable; confirming: inert */}
        <button
          ref={pillRef}
          type="button"
          className={[
            "leading-none outline-none",
            confirming ? "cursor-default pointer-events-none" : "hover:opacity-80 transition-opacity",
          ].join(" ")}
          onClick={() => { if (!confirming) setDropdownOpen((o) => !o); }}
          data-testid={!confirming ? "status-pill" : undefined}
          title={!confirming ? "Change status" : undefined}
        >
          {/* Key-change triggers fade-in animation when label switches */}
          <span
            key={displayStatus}
            className="pill-pop-anim"
            style={{ animation: "pill-label-in 120ms ease-out" }}
          >
            {STATUS_LABELS[displayStatus]}
          </span>
        </button>

        {/* Animated confirm controls — slides in when confirming.
            The pill has white text on a solid status color, so use the white
            ("onColor") tone — the default green ✓ is invisible on the COMPLETE pill. */}
        <InlineConfirm
          show={confirming}
          onConfirm={onConfirm}
          onCancel={onCancel}
          disabled={isTransitioning}
          tone="onColor"
        />
      </div>

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
  current, onSelect, onClose, anchorEl,
}: {
  current: TimelineStatus;
  onSelect: (s: TimelineStatus) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
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
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left ${s === current ? "text-primary font-medium" : "text-foreground"}`}
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
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useAnchorPos(anchorEl);
  // The portal renders null until `pos` resolves, so the input only mounts on the
  // second render — focus once `pos` is available, not on first commit.
  useEffect(() => { if (pos) inputRef.current?.focus(); }, [pos]);
  useOutsideClose(anchorEl, onClose);

  const filtered = members.filter((m) =>
    getDisplayName(m).toLowerCase().includes(query.toLowerCase())
  );
  // Option 0 is always "None"; the rest are the filtered members. activeIndex
  // tracks the keyboard highlight across this combined list.
  const options: { id: string; label: string }[] = [
    { id: "", label: "None" },
    ...filtered.map((m) => ({ id: m.id, label: getDisplayName(m) })),
  ];
  // Narrowing the query resets the highlight to the top.
  useEffect(() => { setActiveIndex(0); }, [query]);

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
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const opt = options[activeIndex];
              if (opt) onSelect(opt.id);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Search members…"
          className="w-full text-xs bg-transparent outline-none px-1 py-0.5 text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        {options.map((opt, idx) => {
          const isActive = idx === activeIndex;
          const isCurrent = (opt.id || null) === (currentId || null);
          return (
            <button
              key={opt.id || "__none__"}
              type="button"
              onClick={() => onSelect(opt.id)}
              onMouseEnter={() => setActiveIndex(idx)}
              data-active={isActive ? "true" : undefined}
              className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left text-xs ${
                isActive ? "bg-muted" : ""
              } ${isCurrent ? "text-primary font-medium" : opt.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              <UserCircle size={12} />
              {opt.label}
              {isCurrent && <span className="ml-auto">✓</span>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground">No members found</p>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── GroupCombobox — portal picker for the deliverable group (pick or create) ──

function GroupCombobox({
  groups, current, onSelect, onClose, anchorEl,
}: {
  groups: string[];
  current: string | null;
  onSelect: (group: string | null) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useAnchorPos(anchorEl);
  useEffect(() => { if (pos) inputRef.current?.focus(); }, [pos]);
  useOutsideClose(anchorEl, onClose);

  const q = query.trim();
  const filtered = groups.filter((g) => g.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length > 0 && !groups.some((g) => g.toLowerCase() === q.toLowerCase());

  // Empty query → "Ungrouped" (clear) + all groups. Typing → matches first, then
  // a "Create '<q>'" option, so Enter matches or creates (never clears).
  const options: { value: string | null; label: string; create?: boolean }[] =
    q.length === 0
      ? [{ value: null, label: "Ungrouped" }, ...groups.map((g) => ({ value: g, label: g }))]
      : [
          ...filtered.map((g) => ({ value: g, label: g })),
          ...(canCreate ? [{ value: q, label: `Create "${q}"`, create: true }] : []),
        ];
  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: "absolute", top: pos.top + 2, left: pos.left, zIndex: 9999, fontFamily: "var(--font-mono)" }}
      onMouseDown={(e) => e.stopPropagation()}
      className="w-52 bg-card border border-border rounded-lg shadow-md overflow-hidden"
      data-testid="group-combobox"
    >
      <div className="p-1.5 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); const o = options[activeIndex]; if (o) onSelect(o.value); }
            else if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
          placeholder="Filter or type a new group…"
          className="w-full text-xs bg-transparent outline-none px-1 py-0.5 text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        {options.map((opt, idx) => {
          const isActive = idx === activeIndex;
          const isCurrent = (opt.value || null) === (current || null) && !opt.create;
          return (
            <button
              key={opt.create ? "__create__" : opt.value ?? "__none__"}
              type="button"
              onClick={() => onSelect(opt.value)}
              onMouseEnter={() => setActiveIndex(idx)}
              data-active={isActive ? "true" : undefined}
              className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left text-xs ${
                isActive ? "bg-muted" : ""
              } ${isCurrent ? "text-primary font-medium" : opt.value ? "text-foreground" : "text-muted-foreground"}`}
            >
              {opt.label}
              {isCurrent && <span className="ml-auto">✓</span>}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// ─── PriorityMenu — small portal menu (LOW / MEDIUM / HIGH) ───────────────────

function PriorityMenu({
  current, onSelect, onClose, anchorEl,
}: {
  current: DeliverablePriority;
  onSelect: (p: DeliverablePriority) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const pos = useAnchorPos(anchorEl);
  useOutsideClose(anchorEl, onClose);
  if (!pos) return null;
  return createPortal(
    <div
      style={{ position: "absolute", top: pos.top + 2, left: pos.left, zIndex: 9999, fontFamily: "var(--font-mono)" }}
      onMouseDown={(e) => e.stopPropagation()}
      className="min-w-[120px] bg-card border border-border rounded-lg shadow-md py-1 text-xs"
      data-testid="priority-menu"
    >
      {ALL_PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left ${p === current ? "text-primary font-medium" : "text-foreground"}`}
        >
          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_META[p].cls}`}>
            {PRIORITY_META[p].label}
          </span>
          {p === current && <span className="ml-auto text-muted-foreground">✓</span>}
        </button>
      ))}
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
  const [groupFilter, setGroupFilter] = useState<string>("ALL"); // "ALL" | "UNGROUPED" | <group>
  const [, startMoveTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Deliverable status popover (standalone deliverables only)
  const [deliverableStatusMenuFor, setDeliverableStatusMenuFor] = useState<string | null>(null);

  // Pending deliverable status confirm (✓/✗ microinteraction, no-subtask deliverables)
  const [pendingDeliverableStatus, setPendingDeliverableStatus] = useState<{
    id: string;
    status: TimelineStatus;
  } | null>(null);
  const [isDelivStatusPending, startDelivStatusTransition] = useTransition();

  // Armed deliverable delete confirm (✓/✗ microinteraction)
  const [confirmingDeliverableDelete, setConfirmingDeliverableDelete] = useState<string | null>(null);
  const [isDelivDeletePending, startDelivDeleteTransition] = useTransition();

  // Inline group combobox
  const [groupMenuFor, setGroupMenuFor] = useState<string | null>(null);
  const [, startGroupTransition] = useTransition();
  const deliverableGroupRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Deliverable description: click body to expand; inline (md/plain) edit while open
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<string | null>(null);
  const [deliverableDescEdit, setDeliverableDescEdit] = useState<{ id: string; value: string } | null>(null);
  const [isDescPending, startDescTransition] = useTransition();

  // Inline priority menu
  const [priorityMenuFor, setPriorityMenuFor] = useState<string | null>(null);
  const [, startPriorityTransition] = useTransition();
  const deliverablePriorityRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

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

  // Click a subtask title to expand its description (pushes siblings down)
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  // Inline-edit the expanded subtask description (Markdown/plain), like deliverables
  const [subtaskDescEdit, setSubtaskDescEdit] = useState<{ id: string; value: string } | null>(null);
  const [isSubtaskDescPending, startSubtaskDescTransition] = useTransition();

  // Deliverable inline editing
  const [deliverableEdit, setDeliverableEdit] = useState<{
    id: string;
    field: "title" | "dates";
    title: string;
    startDate: string;
    targetDate: string;
  } | null>(null);
  const [isDelivEditPending, startDelivEditTransition] = useTransition();
  const [delivEditError, setDelivEditError] = useState<string | null>(null);
  const delivTitleInputRef = useRef<HTMLInputElement | null>(null);

  function confirmDeliverableStatus() {
    if (!pendingDeliverableStatus || isDelivStatusPending) return;
    const { id, status } = pendingDeliverableStatus;
    setPendingDeliverableStatus(null);
    startDelivStatusTransition(async () => { await updateDeliverableStatus(id, status); });
  }
  function cancelDeliverableStatus() {
    setPendingDeliverableStatus(null);
  }

  function confirmDeliverableDelete(id: string) {
    if (isDelivDeletePending) return;
    startDelivDeleteTransition(async () => {
      await deleteDeliverableAction(id);
      setConfirmingDeliverableDelete(null);
    });
  }

  // Distinct groups used across this project's deliverables (for the combobox)
  const allGroups = Array.from(
    new Set(deliverables.map((d) => d.group).filter((g): g is string => !!g))
  ).sort((a, b) => a.localeCompare(b));

  function commitGroup(id: string, group: string | null) {
    setGroupMenuFor(null);
    startGroupTransition(async () => { await updateDeliverableGroup(id, group); });
  }

  function commitDescEdit() {
    if (!deliverableDescEdit || isDescPending) return;
    const { id, value } = deliverableDescEdit;
    setDeliverableDescEdit(null);
    startDescTransition(async () => { await updateDeliverableDescription(id, value || null); });
  }

  function commitSubtaskDescEdit() {
    if (!subtaskDescEdit || isSubtaskDescPending) return;
    const { id, value } = subtaskDescEdit;
    setSubtaskDescEdit(null);
    startSubtaskDescTransition(async () => { await updateSubtaskDescription(id, value || null); });
  }

  function commitPriority(id: string, priority: DeliverablePriority) {
    setPriorityMenuFor(null);
    startPriorityTransition(async () => { await updateDeliverablePriority(id, priority); });
  }

  function startDelivEdit(field: "title" | "dates", d: Deliverable) {
    setDeliverableEdit({
      id: d.id,
      field,
      title: d.title,
      startDate: toDateInput(d.startDate),
      targetDate: toDateInput(d.targetDate),
    });
    setDelivEditError(null);
    if (field === "title") setTimeout(() => { delivTitleInputRef.current?.select(); }, 0);
  }

  function commitDelivEdit() {
    if (!deliverableEdit || isDelivEditPending) return;
    const { id, field, title, startDate, targetDate } = deliverableEdit;
    if (field === "dates" && startDate && targetDate && startDate > targetDate) {
      setDelivEditError("Start must be before target");
      return;
    }
    setDeliverableEdit(null);
    setDelivEditError(null);
    startDelivEditTransition(async () => {
      if (field === "title") await updateDeliverableTitle(id, title);
      else await updateDeliverableDates(id, startDate || null, targetDate);
    });
  }

  function cancelDelivEdit() {
    setDeliverableEdit(null);
    setDelivEditError(null);
  }

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

  // ── Filter + sort + group ────────────────────────────────────────────────────

  function moveDeliv(id: string, dir: "up" | "down") {
    startMoveTransition(async () => { await moveDeliverable(id, dir); });
  }

  // Default within-group order: priority DESC (HIGH on top), then manual orderIndex.
  const byPriorityThenOrder = (a: Deliverable, b: Deliverable) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.orderIndex - b.orderIndex;

  const filteredDeliverables =
    groupFilter === "ALL"
      ? deliverables
      : groupFilter === "UNGROUPED"
        ? deliverables.filter((d) => !d.group)
        : deliverables.filter((d) => d.group === groupFilter);

  const sorted = sortByStatus
    ? [...filteredDeliverables].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    : filteredDeliverables;

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
      items: [...items].sort(byPriorityThenOrder),
    }));
  } else {
    sections = [{ label: null, items: sortByStatus ? sorted : [...sorted].sort(byPriorityThenOrder) }];
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Sort toggle + add */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Deliverables</h2>
        <div className="flex items-center gap-3">
          {allGroups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid="group-filter"
              aria-label="Filter by group"
            >
              <option value="ALL">All groups</option>
              <option value="UNGROUPED">Ungrouped</option>
              {allGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
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
                {items.map((deliverable, di) => {
                  const badge = STATUS_BADGE[deliverable.status];
                  const isOverdue = !deliverable.completed && new Date(deliverable.targetDate) < new Date();
                  // Items are sorted priority-then-orderIndex, so same-priority rows are
                  // contiguous; a deliverable can move within its priority tier only.
                  const canMoveUp = !sortByStatus && di > 0 && items[di - 1].priority === deliverable.priority;
                  const canMoveDown = !sortByStatus && di < items.length - 1 && items[di + 1].priority === deliverable.priority;
                  const hasSubtasks = deliverable.subtasks.length > 0;

                  return (
                    <div key={deliverable.id} data-deliverable-id={deliverable.id} className="border border-border rounded-xl overflow-hidden">
                      {/* Deliverable header — click the body (not a control) to expand the description */}
                      <div
                        className="flex items-start justify-between gap-4 p-4 bg-card group/deliv cursor-pointer"
                        role="button"
                        aria-expanded={expandedDeliverableId === deliverable.id}
                        data-testid="deliverable-header"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest(
                            'button, a, input, select, textarea, [data-no-expand]'
                          )) return;
                          setExpandedDeliverableId((cur) => (cur === deliverable.id ? null : deliverable.id));
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Inline title edit */}
                            {deliverableEdit?.id === deliverable.id && deliverableEdit.field === "title" ? (
                              <span className="inline-flex items-center gap-1 flex-1 min-w-0">
                                <input
                                  ref={delivTitleInputRef}
                                  type="text"
                                  value={deliverableEdit.title}
                                  onChange={(e) =>
                                    setDeliverableEdit({ ...deliverableEdit, title: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitDelivEdit();
                                    if (e.key === "Escape") cancelDelivEdit();
                                  }}
                                  className="text-sm font-medium bg-transparent border-b border-primary outline-none min-w-[120px] flex-1"
                                  data-testid="deliv-title-input"
                                />
                                <InlineConfirm
                                  show
                                  onConfirm={commitDelivEdit}
                                  onCancel={cancelDelivEdit}
                                  disabled={isDelivEditPending}
                                />
                              </span>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-foreground">
                                  {deliverable.title}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => startDelivEdit("title", deliverable)}
                                    className="opacity-0 group-hover/deliv:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    title="Edit title"
                                    data-testid="deliv-title-pencil"
                                  >
                                    <PencilSimple size={12} />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Deliverable status badge — 3 variants */}
                            {hasSubtasks ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                                      data-testid="deliverable-locked-badge"
                                    />
                                  }
                                >
                                  {badge.label}
                                  <LockSimple size={8} />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="text-[11px] px-2.5 py-1.5 font-normal normal-case tracking-normal"
                                  style={{ fontFamily: "var(--font-mono)" }}
                                >
                                  {LOCK_REASON[deliverable.status]}
                                </TooltipContent>
                              </Tooltip>
                            ) : canEdit ? (
                              (() => {
                                const pending = pendingDeliverableStatus?.id === deliverable.id
                                  ? pendingDeliverableStatus.status
                                  : null;
                                const dispBadge = STATUS_BADGE[pending ?? deliverable.status];
                                return (
                              <div className="relative inline-flex items-center gap-1">
                                <button
                                  ref={(el) => { deliverableDotRefs.current.set(deliverable.id, el); }}
                                  type="button"
                                  onClick={() => {
                                    if (pending) return;
                                    setDeliverableStatusMenuFor(
                                      deliverableStatusMenuFor === deliverable.id ? null : deliverable.id
                                    );
                                  }}
                                  className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full transition-opacity ${pending ? "" : "hover:opacity-80 cursor-pointer"} ${dispBadge.bg} ${dispBadge.text}`}
                                  title={pending ? undefined : "Change status"}
                                  data-testid="deliverable-status-badge"
                                >
                                  {dispBadge.label}
                                </button>
                                <span data-testid="deliv-status-confirm">
                                  <InlineConfirm
                                    show={pending !== null}
                                    onConfirm={confirmDeliverableStatus}
                                    onCancel={cancelDeliverableStatus}
                                    disabled={isDelivStatusPending}
                                  />
                                </span>
                                {deliverableStatusMenuFor === deliverable.id && (
                                  <DeliverableStatusPopover
                                    current={deliverable.status}
                                    onSelect={(s) => {
                                      setPendingDeliverableStatus({ id: deliverable.id, status: s });
                                      setDeliverableStatusMenuFor(null);
                                    }}
                                    onClose={() => setDeliverableStatusMenuFor(null)}
                                    anchorEl={deliverableDotRefs.current.get(deliverable.id) ?? null}
                                  />
                                )}
                              </div>
                                );
                              })()
                            ) : (
                              <span
                                className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            )}

                            {/* Inline priority chip / menu */}
                            {canEdit ? (
                              <div className="relative inline-flex">
                                <button
                                  ref={(el) => { deliverablePriorityRefs.current.set(deliverable.id, el); }}
                                  type="button"
                                  onClick={() =>
                                    setPriorityMenuFor(priorityMenuFor === deliverable.id ? null : deliverable.id)
                                  }
                                  className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-opacity hover:opacity-80 ${PRIORITY_META[deliverable.priority].cls}`}
                                  style={{ fontFamily: "var(--font-mono)" }}
                                  title="Set priority"
                                  data-testid="deliverable-priority"
                                >
                                  {PRIORITY_META[deliverable.priority].label}
                                </button>
                                {priorityMenuFor === deliverable.id && (
                                  <PriorityMenu
                                    current={deliverable.priority}
                                    onSelect={(p) => commitPriority(deliverable.id, p)}
                                    onClose={() => setPriorityMenuFor(null)}
                                    anchorEl={deliverablePriorityRefs.current.get(deliverable.id) ?? null}
                                  />
                                )}
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_META[deliverable.priority].cls}`}
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                {PRIORITY_META[deliverable.priority].label}
                              </span>
                            )}

                            {/* Inline group chip / combobox */}
                            {canEdit ? (
                              <div className="relative inline-flex">
                                <button
                                  ref={(el) => { deliverableGroupRefs.current.set(deliverable.id, el); }}
                                  type="button"
                                  onClick={() =>
                                    setGroupMenuFor(groupMenuFor === deliverable.id ? null : deliverable.id)
                                  }
                                  className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${
                                    deliverable.group
                                      ? "bg-muted text-muted-foreground hover:text-foreground"
                                      : "text-muted-foreground/60 hover:text-foreground"
                                  }`}
                                  style={{ fontFamily: "var(--font-mono)" }}
                                  title="Edit group"
                                  data-testid="deliverable-group"
                                >
                                  {deliverable.group ?? "+ Group"}
                                </button>
                                {groupMenuFor === deliverable.id && (
                                  <GroupCombobox
                                    groups={allGroups}
                                    current={deliverable.group}
                                    onSelect={(g) => commitGroup(deliverable.id, g)}
                                    onClose={() => setGroupMenuFor(null)}
                                    anchorEl={deliverableGroupRefs.current.get(deliverable.id) ?? null}
                                  />
                                )}
                              </div>
                            ) : deliverable.group ? (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                {deliverable.group}
                              </span>
                            ) : null}
                          </div>
                          {/* Inline dates edit */}
                          {deliverableEdit?.id === deliverable.id && deliverableEdit.field === "dates" ? (
                            <div
                              className="flex flex-wrap items-center gap-2 mt-1 text-xs"
                              style={{ fontFamily: "var(--font-mono)" }}
                              data-testid="deliv-dates-edit"
                            >
                              <span className="text-muted-foreground">Start:</span>
                              <input
                                type="date"
                                value={deliverableEdit.startDate}
                                onChange={(e) =>
                                  setDeliverableEdit({ ...deliverableEdit, startDate: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") cancelDelivEdit();
                                }}
                                className="bg-transparent border-b border-primary outline-none text-foreground"
                                data-testid="deliv-start-input"
                              />
                              <span className="text-muted-foreground">Target:</span>
                              <input
                                type="date"
                                value={deliverableEdit.targetDate}
                                onChange={(e) =>
                                  setDeliverableEdit({ ...deliverableEdit, targetDate: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitDelivEdit();
                                  if (e.key === "Escape") cancelDelivEdit();
                                }}
                                className="bg-transparent border-b border-primary outline-none text-foreground"
                                data-testid="deliv-target-input"
                              />
                              <InlineConfirm
                                show
                                onConfirm={commitDelivEdit}
                                onCancel={cancelDelivEdit}
                                disabled={isDelivEditPending}
                              />
                              {delivEditError && (
                                <span className="text-[#A4503C]">{delivEditError}</span>
                              )}
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-1 mt-1 group/deliv-dates"
                            >
                              <p
                                className="text-xs text-muted-foreground"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                Target: {formatDate(deliverable.targetDate)}
                                {deliverable.startDate && <> &middot; Start: {formatDate(deliverable.startDate)}</>}
                                {isOverdue && <span className="text-[#A4503C] ml-2">overdue</span>}
                              </p>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => startDelivEdit("dates", deliverable)}
                                  className="opacity-0 group-hover/deliv-dates:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-1"
                                  title="Edit dates"
                                  data-testid="deliv-dates-pencil"
                                >
                                  <PencilSimple size={10} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {(canMoveUp || canMoveDown) && (
                              <div className="flex flex-col -my-1" data-testid="deliverable-reorder">
                                <button
                                  type="button"
                                  onClick={() => moveDeliv(deliverable.id, "up")}
                                  disabled={!canMoveUp}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                  title="Move up"
                                  data-testid="deliverable-move-up"
                                >
                                  <CaretUp size={11} weight="bold" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDeliv(deliverable.id, "down")}
                                  disabled={!canMoveDown}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                  title="Move down"
                                  data-testid="deliverable-move-down"
                                >
                                  <CaretDown size={11} weight="bold" />
                                </button>
                              </div>
                            )}
                            <DeliverableModal
                              deliverable={{
                                id: deliverable.id,
                                title: deliverable.title,
                                description: deliverable.description,
                                status: deliverable.status,
                                priority: deliverable.priority,
                                group: deliverable.group,
                                startDate: deliverable.startDate,
                                targetDate: deliverable.targetDate,
                              }}
                              groups={allGroups}
                              hasSubtasks={deliverable.subtasks.length > 0}
                              trigger={
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  style={{ fontFamily: "var(--font-mono)" }}
                                  data-testid="deliverable-edit"
                                >
                                  Edit
                                </button>
                              }
                            />
                            {confirmingDeliverableDelete === deliverable.id ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                style={{ fontFamily: "var(--font-mono)" }}
                                data-testid="deliv-delete-confirm"
                              >
                                Delete?
                                <InlineConfirm
                                  show
                                  onConfirm={() => confirmDeliverableDelete(deliverable.id)}
                                  onCancel={() => setConfirmingDeliverableDelete(null)}
                                  disabled={isDelivDeletePending}
                                />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingDeliverableDelete(deliverable.id)}
                                className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                                style={{ fontFamily: "var(--font-mono)" }}
                                data-testid="deliverable-delete"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded description — read + inline (md/plain) edit, no modal */}
                      {expandedDeliverableId === deliverable.id && (
                        <div
                          className="px-4 pb-3 border-t border-border bg-card text-xs text-muted-foreground"
                          data-testid="deliverable-description"
                        >
                          {deliverableDescEdit?.id === deliverable.id ? (
                            <div className="pt-3 space-y-2">
                              <MarkdownEditor
                                value={deliverableDescEdit.value}
                                onChange={(v) => setDeliverableDescEdit({ id: deliverable.id, value: v })}
                                rows={4}
                                placeholder="Describe this deliverable… (Markdown supported)"
                                textareaTestId="deliverable-desc-input"
                              />
                              <div className="flex justify-end">
                                <InlineConfirm
                                  show
                                  onConfirm={commitDescEdit}
                                  onCancel={() => setDeliverableDescEdit(null)}
                                  disabled={isDescPending}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="pt-3 flex items-start justify-between gap-2 group/deliv-desc">
                              <div className="flex-1 min-w-0">
                                {deliverable.description ? (
                                  <MarkdownView>{deliverable.description}</MarkdownView>
                                ) : (
                                  <p className="italic opacity-60">No description</p>
                                )}
                              </div>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeliverableDescEdit({ id: deliverable.id, value: deliverable.description ?? "" })
                                  }
                                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit description"
                                  data-testid="deliverable-desc-edit"
                                >
                                  <PencilSimple size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

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

                            // Right-panel mode drives the slide animation.
                            // Title edits confirm next to the title (not in the right panel),
                            // so the title field stays in "controls" mode here.
                            const rowMode = isEditing && editField !== "title" ? "edit"
                              : confirmingDelete === subtask.id ? "delete"
                              : "controls";

                            // Glow on hover or while actively editing this subtask
                            const isActive = isEditing || pendingStatusEdit?.subtaskId === subtask.id;
                            const dotColor = STATUS_DOT_COLOR[subtask.status];

                            return (
                              <div
                                key={subtask.id}
                                className="group/subtask bg-background/50"
                                data-testid="subtask-row"
                              >
                              <div
                                className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                                role="button"
                                aria-expanded={expandedSubtaskId === subtask.id}
                                data-testid="subtask-row-body"
                                onClick={(e) => {
                                  // Toggle the description unless the click landed on an interactive control.
                                  // (All inline controls are real <button>/<input> elements; the row's own
                                  //  role="button" is a <div>, so closest('button') never self-matches.)
                                  if ((e.target as HTMLElement).closest(
                                    'button, a, input, select, textarea, [data-no-expand]'
                                  )) return;
                                  setExpandedSubtaskId((cur) => (cur === subtask.id ? null : subtask.id));
                                }}
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
                                      <>
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
                                        {/* Confirm sits next to the title, not in the right panel */}
                                        <InlineConfirm
                                          show
                                          onConfirm={commitEdit}
                                          onCancel={cancelEdit}
                                          disabled={isPendingEdit}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedSubtaskId((cur) =>
                                              cur === subtask.id ? null : subtask.id
                                            )
                                          }
                                          aria-expanded={expandedSubtaskId === subtask.id}
                                          className="text-xs text-foreground truncate text-left hover:text-primary transition-colors"
                                          data-testid="subtask-title-toggle"
                                          title="Show description"
                                        >
                                          {subtask.title}
                                        </button>
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
                                      {assigneePickerOpen && isEditing && editField === "assignee" && (
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
                                      max={deliverable.targetDate.slice(0, 10)}
                                      min={deliverable.startDate ? deliverable.startDate.slice(0, 10) : undefined}
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
                                      {formatDueDate(displayDueDate)}
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
                                        {canEdit && (
                                          <SubtaskModal
                                            mode="edit"
                                            deliverableId={deliverable.id}
                                            members={members}
                                            deliverableStart={deliverable.startDate}
                                            deliverableTarget={deliverable.targetDate}
                                            subtask={{
                                              id: subtask.id,
                                              title: subtask.title,
                                              description: subtask.description,
                                              assigneeId: subtask.assignee?.id ?? null,
                                              dueDate: subtask.dueDate,
                                              status: subtask.status,
                                            }}
                                            trigger={
                                              <button
                                                type="button"
                                                className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/subtask:opacity-100"
                                                title="Edit subtask"
                                                data-testid="edit-subtask-modal"
                                              >
                                                <NotePencil size={13} />
                                              </button>
                                            }
                                          />
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

                              {/* Expanded description — pushes following rows down */}
                              {expandedSubtaskId === subtask.id && (
                                <div
                                  className="px-4 pb-3 pl-[1.375rem] text-xs text-muted-foreground"
                                  data-testid="subtask-description"
                                >
                                  {subtaskDescEdit?.id === subtask.id ? (
                                    <div className="space-y-2">
                                      <MarkdownEditor
                                        value={subtaskDescEdit.value}
                                        onChange={(v) => setSubtaskDescEdit({ id: subtask.id, value: v })}
                                        rows={3}
                                        placeholder="Describe this subtask… (Markdown supported)"
                                        textareaTestId="subtask-desc-input"
                                      />
                                      <div className="flex justify-end">
                                        <InlineConfirm
                                          show
                                          onConfirm={commitSubtaskDescEdit}
                                          onCancel={() => setSubtaskDescEdit(null)}
                                          disabled={isSubtaskDescPending}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between gap-2 group/subtask-desc">
                                      <div className="flex-1 min-w-0">
                                        {subtask.description ? (
                                          <MarkdownView>{subtask.description}</MarkdownView>
                                        ) : (
                                          <p className="italic opacity-60">No description</p>
                                        )}
                                      </div>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSubtaskDescEdit({ id: subtask.id, value: subtask.description ?? "" })
                                          }
                                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                          title="Edit description"
                                          data-testid="subtask-desc-edit"
                                        >
                                          <PencilSimple size={11} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add subtask — opens the create modal */}
                      {canManage && (
                        <div className="border-t border-border px-4 py-2">
                          <SubtaskModal
                            mode="create"
                            deliverableId={deliverable.id}
                            members={members}
                            deliverableStart={deliverable.startDate}
                            deliverableTarget={deliverable.targetDate}
                            trigger={
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                style={{ fontFamily: "var(--font-mono)" }}
                                data-testid="add-subtask"
                              >
                                <Plus size={10} />
                                Add subtask
                              </button>
                            }
                          />
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
