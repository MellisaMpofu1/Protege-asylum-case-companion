// Date helpers. Instants are stored in UTC and shown in Europe/Lisbon.
// Date-only values (YYYY-MM-DD) are never converted through a timezone.
export const LISBON_TZ = "Europe/Lisbon";

export type Locale = "en" | "pt-PT";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a date-only string without timezone shifting. */
export function formatDateOnly(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const m = DATE_ONLY.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  // Use UTC midnight + UTC formatting so the calendar day never moves.
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/** Format a UTC instant in Europe/Lisbon with the timezone shown. */
export function formatInstant(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LISBON_TZ,
    timeZoneName: "short",
  }).format(dt);
}

/** Today's calendar date in Lisbon as YYYY-MM-DD. */
export function todayInLisbon(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Overdue only when a confirmed date exists, is before today (Lisbon) and the action is still pending. */
export function isOverdue(
  a: { due_date: string | null; due_confirmed: boolean; status: string },
  today = todayInLisbon(),
): boolean {
  return a.status === "pending" && a.due_confirmed && !!a.due_date && a.due_date < today;
}

/** Convert a Lisbon wall-clock "YYYY-MM-DDTHH:mm" (from a datetime-local input) to a UTC ISO string. */
export function lisbonLocalToUtcIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Offset of Lisbon at that moment (handles DST).
  const offset = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: LISBON_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t;
  };
  let t = guess - offset(guess);
  t = guess - offset(t);
  return new Date(t).toISOString();
}

/** Inverse: UTC ISO → Lisbon "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
export function utcIsoToLisbonLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
