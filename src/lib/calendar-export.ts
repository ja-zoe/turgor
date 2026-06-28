export interface ExportEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
function toDateValue(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line: string): string {
  // RFC 5545: fold lines longer than 75 octets (continuation lines start with a space).
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** Build an RFC-5545 ICS document for the given events. */
export function buildIcs(events: ExportEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SEED Tracker//Semester Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  const stamp = toUtcStamp(new Date());
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@seed-tracker`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toDateValue(e.startsAt)}`);
      const end = e.endsAt ?? e.startsAt;
      lines.push(`DTEND;VALUE=DATE:${toDateValue(new Date(end.getTime() + 86_400_000))}`); // exclusive
    } else {
      lines.push(`DTSTART:${toUtcStamp(e.startsAt)}`);
      const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3_600_000);
      lines.push(`DTEND:${toUtcStamp(end)}`);
    }
    lines.push(fold(`SUMMARY:${escapeText(e.title)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeText(e.location)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeText(e.description)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** A prefilled "Add to Google Calendar" template URL for one event. */
export function googleCalendarUrl(e: ExportEvent): string {
  const start = e.allDay ? toDateValue(e.startsAt) : toUtcStamp(e.startsAt);
  const endDate = e.allDay
    ? toDateValue(new Date((e.endsAt ?? e.startsAt).getTime() + 86_400_000))
    : toUtcStamp(e.endsAt ?? new Date(e.startsAt.getTime() + 3_600_000));
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${start}/${endDate}` });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
