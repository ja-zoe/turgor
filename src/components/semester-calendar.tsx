"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarBlank,
  Users,
  UsersThree,
  Crown,
  Star,
  Plus,
  X,
  CaretLeft,
  CaretRight,
  List,
  GridFour,
} from "@phosphor-icons/react";
import { createEvent, updateEvent, deleteEvent } from "@/lib/actions/calendar";
import { googleCalendarUrl } from "@/lib/calendar-export";

type EventType = "PROJECT_MEETING" | "NON_PROJECT_EVENT" | "LEAD_MEETING" | "EBOARD_MEETING";

interface CalendarEvent {
  id: string;
  title: string;
  semester: string;
  semesters: string[];
  type: EventType;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
}

interface Project {
  id: string;
  name: string;
  semester: string;
}

interface Props {
  events: CalendarEvent[];
  canEdit: boolean;
  semester: string;
  allSemesters: string[];
  projects: Project[];
}

const TYPE_COLOR: Record<EventType, { bg: string; text: string; border: string }> = {
  PROJECT_MEETING: { bg: "bg-[#EDF3EC]", text: "text-[#2E4034]", border: "border-[#2E4034]/20" },
  NON_PROJECT_EVENT: { bg: "bg-[#FBF3DB]", text: "text-[#7A5C00]", border: "border-[#C99846]/30" },
  LEAD_MEETING: { bg: "bg-[#E1F3FE]", text: "text-[#1F6C9F]", border: "border-[#1F6C9F]/30" },
  EBOARD_MEETING: { bg: "bg-[#F3E8FF]", text: "text-[#6B3FA0]", border: "border-[#6B3FA0]/30" },
};

const TYPE_ICON: Record<EventType, React.ReactNode> = {
  PROJECT_MEETING: <Users size={11} weight="fill" />,
  NON_PROJECT_EVENT: <Star size={11} weight="fill" />,
  LEAD_MEETING: <UsersThree size={11} weight="fill" />,
  EBOARD_MEETING: <Crown size={11} weight="fill" />,
};

const TYPE_LABEL: Record<EventType, string> = {
  PROJECT_MEETING: "Project Meeting",
  NON_PROJECT_EVENT: "Non-Project Event",
  LEAD_MEETING: "Lead Meeting",
  EBOARD_MEETING: "Eboard Meeting",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Event editor modal ─────────────────────────────────────────────────────

interface EditorProps {
  event: CalendarEvent | null;
  defaultDate: string | null;
  semester: string;
  allSemesters: string[];
  projects: Project[];
  canEdit: boolean;
  onClose: () => void;
}

/** Types that govern Project Standing across whole semesters (not a single project). */
const MULTI_SEMESTER_TYPES: EventType[] = ["LEAD_MEETING", "EBOARD_MEETING"];

function EventEditor({ event, defaultDate, semester, allSemesters, projects, canEdit, onClose }: EditorProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isNew = !event;

  const [eventType, setEventType] = useState<EventType>(event?.type ?? "PROJECT_MEETING");
  // Which semesters a lead/eboard meeting is pinned to. Seeded from the event (or the
  // active semester for a new one); the active semester is always available to pick.
  const semesterOptions = [...new Set([semester, ...allSemesters].filter(Boolean))];
  const initialPinned =
    event && event.semesters.length > 0
      ? event.semesters
      : event
        ? [event.semester]
        : [semester].filter(Boolean);
  const [pinnedSemesters, setPinnedSemesters] = useState<string[]>(initialPinned);
  const isMultiSemester = MULTI_SEMESTER_TYPES.includes(eventType);

  function togglePinned(s: string) {
    setPinnedSemesters((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  const defaultStartsAt = defaultDate
    ? `${defaultDate}T09:00`
    : event?.startsAt
      ? new Date(event.startsAt).toISOString().slice(0, 16)
      : "";

  function handleClose(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (isNew) {
        await createEvent(formData);
      } else {
        await updateEvent(event.id, formData);
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!event) return;
    startTransition(async () => {
      await deleteEvent(event.id);
      onClose();
    });
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {isNew ? "Add Event" : (canEdit ? "Edit Event" : "Event Details")}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Read-only details view */}
        {!canEdit && event && (
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-base font-medium text-foreground">{event.title}</p>
              {event.projectName && (
                <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  {event.projectName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLOR[event.type].bg} ${TYPE_COLOR[event.type].text}`}>
                {TYPE_ICON[event.type]} {TYPE_LABEL[event.type]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {event.allDay ? "All day · " : ""}{formatDate(event.startsAt)}
              {!event.allDay && ` · ${formatTime(event.startsAt)}`}
              {event.endsAt && ` – ${formatTime(event.endsAt)}`}
            </p>
            {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
            {event.description && <p className="text-sm text-foreground">{event.description}</p>}
          </div>
        )}

        {/* Per-event "Add to Google Calendar" — for any viewer of an existing event */}
        {event && !isNew && (
          <div className="px-5 pt-3">
            <a
              href={googleCalendarUrl({
                id: event.id,
                title: event.title,
                startsAt: new Date(event.startsAt),
                endsAt: event.endsAt ? new Date(event.endsAt) : null,
                allDay: event.allDay,
                location: event.location,
                description: event.description,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              style={{ fontFamily: "var(--font-mono)" }}
              data-testid="add-to-google"
            >
              <CalendarBlank size={12} /> Add to Google Calendar
            </a>
          </div>
        )}

        {/* Edit / create form */}
        {canEdit && (
          <form action={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Active semester is the fallback for single-semester event types. For
                lead/eboard meetings the pinned set below (name="semesters") wins. */}
            <input type="hidden" name="semester" value={semester} />
            {isMultiSemester &&
              pinnedSemesters.map((s) => <input key={s} type="hidden" name="semesters" value={s} />)}

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                Title *
              </label>
              <input
                name="title"
                type="text"
                required
                defaultValue={event?.title ?? ""}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                Type
              </label>
              <select
                name="type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <option value="PROJECT_MEETING">Project Meeting</option>
                <option value="NON_PROJECT_EVENT">Non-Project Event</option>
                <option value="LEAD_MEETING">Lead Meeting</option>
                <option value="EBOARD_MEETING">Eboard Meeting</option>
              </select>
            </div>

            {/* Multi-semester pinning — a lead/eboard meeting governs Project Standing
                for every project in the chosen semesters. */}
            {isMultiSemester && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                  Applies to semesters
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Opens Project Standing submissions for every project in the selected semesters.
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2" data-testid="meeting-semesters">
                  {semesterOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No semesters yet — create a project first.</p>
                  ) : (
                    semesterOptions.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm text-foreground cursor-pointer" style={{ fontFamily: "var(--font-mono)" }}>
                        <input
                          type="checkbox"
                          checked={pinnedSemesters.includes(s)}
                          onChange={() => togglePinned(s)}
                          className="accent-primary"
                          data-testid={`meeting-semester-${s}`}
                        />
                        {s}
                      </label>
                    ))
                  )}
                </div>
                {pinnedSemesters.length === 0 && (
                  <p className="text-[11px] text-[#A4503C] mt-1">Select at least one semester.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                  Starts At *
                </label>
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultStartsAt}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                  Ends At
                </label>
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={event?.endsAt ? new Date(event.endsAt).toISOString().slice(0, 16) : ""}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                Project (optional)
              </label>
              <select
                name="projectId"
                defaultValue={event?.projectId ?? ""}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                Location
              </label>
              <input
                name="location"
                type="text"
                defaultValue={event?.location ?? ""}
                placeholder="e.g. Room 101"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                Notes
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={event?.description ?? ""}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending || (isMultiSemester && pinnedSemesters.length === 0)}
                  className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Saving…" : isNew ? "Add Event" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
              {!isNew && (
                <div>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="text-xs text-[#A4503C] hover:text-[#A4503C]/70 transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Month Grid ─────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  events,
  today,
  canEdit,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  today: Date;
  canEdit: boolean;
  onDayClick: (dateStr: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun

  const days: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete weeks
  while (days.length % 7 !== 0) days.push(null);

  const eventsOnDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startsAt), day));

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground py-1" style={{ fontFamily: "var(--font-mono)" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid rows */}
      <div className="grid grid-cols-7 border-t border-l border-border">
        {days.map((day, i) => {
          const isToday = day ? isSameDay(day, today) : false;
          const dayEvents = day ? eventsOnDay(day) : [];
          return (
            <div
              key={i}
              className={`border-r border-b border-border min-h-[80px] p-1 ${
                day && canEdit ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
              } ${isToday ? "bg-[#EDF3EC]/40" : ""}`}
              onClick={() => {
                if (day && canEdit) {
                  onDayClick(`${year}-${String(month + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
                }
              }}
            >
              {day && (
                <>
                  <p
                    className={`text-[11px] mb-0.5 font-mono ${
                      isToday
                        ? "text-[#2E4034] font-semibold"
                        : "text-muted-foreground"
                    }`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {day.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const c = TYPE_COLOR[e.type];
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                          className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${c.bg} ${c.text} border ${c.border} hover:opacity-80 transition-opacity`}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {TYPE_ICON[e.type]}
                          <span className="truncate">{e.title}</span>
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1" style={{ fontFamily: "var(--font-mono)" }}>
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda View ────────────────────────────────────────────────────────────

function AgendaView({
  events,
  canEdit,
  onAddClick,
  onEventClick,
}: {
  events: CalendarEvent[];
  canEdit: boolean;
  onAddClick: () => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">No events scheduled yet.</p>
        {canEdit && (
          <button
            type="button"
            onClick={onAddClick}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors"
          >
            <Plus size={14} />
            Add first event
          </button>
        )}
      </div>
    );
  }

  // Group by week
  const weeks = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(e);
  }

  return (
    <div className="space-y-6">
      {[...weeks.entries()].map(([weekStart, weekEvents]) => {
        const weekDate = new Date(weekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekDate.getDate() + 6);
        return (
          <div key={weekStart}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Week of {weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <div className="space-y-2">
              {weekEvents.map((e) => {
                const c = TYPE_COLOR[e.type];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onEventClick(e)}
                    className={`w-full text-left px-4 py-3 rounded-lg border ${c.border} ${c.bg} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`${c.text}`}>{TYPE_ICON[e.type]}</span>
                          <span className={`text-sm font-medium ${c.text}`}>{e.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                          {formatDate(e.startsAt)}
                          {!e.allDay && ` · ${formatTime(e.startsAt)}`}
                          {e.endsAt && !e.allDay && ` – ${formatTime(e.endsAt)}`}
                          {e.location && ` · ${e.location}`}
                        </p>
                        {e.projectName && (
                          <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                            {e.projectName}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SemesterCalendar({ events, canEdit, semester, allSemesters, projects }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "agenda">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("calendar-view") as "month" | "agenda") ?? "month";
    }
    return "month";
  });

  const today = new Date();
  // Open on the month of the event nearest today (not the semester's *earliest* event),
  // so a multi-month semester lands on the current month. Falls back to today.
  const anchorDate = (() => {
    if (events.length === 0) return today;
    const now = today.getTime();
    let best = events[0];
    let bestDist = Math.abs(new Date(best.startsAt).getTime() - now);
    for (const e of events) {
      const dist = Math.abs(new Date(e.startsAt).getTime() - now);
      if (dist < bestDist) { best = e; bestDist = dist; }
    }
    return new Date(best.startsAt);
  })();
  const [displayMonth, setDisplayMonth] = useState(anchorDate.getMonth());
  const [displayYear, setDisplayYear] = useState(anchorDate.getFullYear());

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | null>(null);

  function switchView(v: "month" | "agenda") {
    setView(v);
    localStorage.setItem("calendar-view", v);
  }

  function openNewEvent(dateStr?: string) {
    setEditingEvent(null);
    setDefaultDate(dateStr ?? null);
    setEditorOpen(true);
  }

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setDefaultDate(null);
    setEditorOpen(true);
  }

  const monthName = new Date(displayYear, displayMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear((y) => y - 1); }
    else setDisplayMonth((m) => m - 1);
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear((y) => y + 1); }
    else setDisplayMonth((m) => m + 1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)" }}>
            Calendar
          </p>
          <h1
            className="text-3xl text-foreground"
            style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            Semester Calendar
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Semester selector */}
          {allSemesters.length > 1 && (
            <select
              value={semester}
              onChange={(e) => router.push(`/calendar?semester=${encodeURIComponent(e.target.value)}`)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {allSemesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {semester && !allSemesters.includes(semester) && (
            <span className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {semester}
            </span>
          )}

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden" style={{ fontFamily: "var(--font-mono)" }}>
            <button
              type="button"
              onClick={() => switchView("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <GridFour size={13} />
              Month
            </button>
            <button
              type="button"
              onClick={() => switchView("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${view === "agenda" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <List size={13} />
              Agenda
            </button>
          </div>

          <a
            href={`/api/calendar/ics${semester ? `?semester=${encodeURIComponent(semester)}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="export-ics"
          >
            <CalendarBlank size={14} />
            Export .ics
          </a>

          {canEdit && (
            <button
              type="button"
              onClick={() => openNewEvent()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:bg-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add event
            </button>
          )}
        </div>
      </div>

      {/* Empty semester */}
      {!semester && (
        <div className="py-12 text-center border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No semester selected. Create a project first.</p>
        </div>
      )}

      {/* Month view */}
      {semester && view === "month" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <CaretLeft size={16} />
            </button>
            <h2 className="text-sm font-semibold text-foreground">{monthName}</h2>
            <button type="button" onClick={nextMonth} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <CaretRight size={16} />
            </button>
          </div>
          {events.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">No events for {semester} yet.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openNewEvent()}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors"
                >
                  <Plus size={14} />
                  Add first event
                </button>
              )}
            </div>
          ) : (
            <MonthGrid
              year={displayYear}
              month={displayMonth}
              events={events}
              today={today}
              canEdit={canEdit}
              onDayClick={(dateStr) => openNewEvent(dateStr)}
              onEventClick={openEditEvent}
            />
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4">
            {(["PROJECT_MEETING", "NON_PROJECT_EVENT", "LEAD_MEETING", "EBOARD_MEETING"] as EventType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLOR[t].bg} ${TYPE_COLOR[t].text}`}>
                  {TYPE_ICON[t]} {TYPE_LABEL[t]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agenda view */}
      {semester && view === "agenda" && (
        <AgendaView
          events={events}
          canEdit={canEdit}
          onAddClick={() => openNewEvent()}
          onEventClick={openEditEvent}
        />
      )}

      {/* Event editor modal */}
      {editorOpen && (
        <EventEditor
          event={editingEvent}
          defaultDate={defaultDate}
          semester={semester}
          allSemesters={allSemesters}
          projects={projects}
          canEdit={canEdit}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
