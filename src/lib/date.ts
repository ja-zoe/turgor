/**
 * Shared safe date-input parsing (R20.2).
 *
 * Native `<input type="date">` values are `yyyy-mm-dd`. Two failure modes must never
 * crash the app:
 *   1. Truly malformed values (e.g. `2026-13-01`) → `new Date()` returns an Invalid Date,
 *      which throws when Prisma persists it or a later `.toISOString()` runs.
 *   2. Impossible calendar dates (e.g. `2026-06-31`, `2026-02-30`) → `new Date()` silently
 *      ROLLS OVER (06/31 → 07/01), so the user's value is quietly changed.
 *
 * `isValidDateInput` is a pure check usable on client and server; `parseDateInput` is the
 * server-side guard that turns an invalid value into a typed error instead of letting a
 * bad Date reach Prisma.
 */

/** Thrown by `parseDateInput` for an invalid/impossible date so callers can catch it. */
export class DateInputError extends Error {
  constructor(message = "Please enter a valid date.") {
    super(message);
    this.name = "DateInputError";
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True if `value` is an acceptable date-field value: empty (no date) or a real, in-range
 * date that does NOT silently roll over. For `yyyy-mm-dd` we verify the parsed UTC
 * components round-trip to the input (catches impossible days like 06/31, 02/30). For any
 * other shape (e.g. datetime-local) we only require a parseable value.
 */
export function isValidDateInput(value: string | null | undefined): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  if (s === "") return true;

  const m = DATE_ONLY.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    const dt = new Date(`${s}T00:00:00.000Z`);
    if (isNaN(dt.getTime())) return false;
    return (
      dt.getUTCFullYear() === Number(y) &&
      dt.getUTCMonth() + 1 === Number(mo) &&
      dt.getUTCDate() === Number(d)
    );
  }

  return !isNaN(new Date(s).getTime());
}

/**
 * Parse a form date value. Returns `null` for empty, a valid `Date` otherwise, and throws
 * `DateInputError` for an invalid/impossible value (so it never reaches Prisma or rolls
 * over silently). Date-only values are anchored to UTC midnight to match the app's
 * deliberate UTC date formatting (see R14).
 */
export function parseDateInput(raw: FormDataEntryValue | string | null | undefined): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  if (!isValidDateInput(s)) throw new DateInputError();

  // Anchor pure dates to UTC midnight; pass through full datetimes as-is.
  const iso = DATE_ONLY.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new DateInputError();
  return d;
}
