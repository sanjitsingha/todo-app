/** Short weekday names, Sunday first (the order of `Date.getDay()`). */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * A calendar day in the user's local time zone, e.g. "2026-11-11".
 * Stored as a string, not a timestamp, so a due date never shifts with time zones.
 */
export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Thu" */
export function shortWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function relativeDayLabel(key: DateKey, now: Date): string | null {
  if (key === toDateKey(now)) return 'Today';
  if (key === toDateKey(addDays(now, 1))) return 'Tomorrow';
  if (key === toDateKey(addDays(now, -1))) return 'Yesterday';
  return null;
}

function absoluteDayLabel(key: DateKey, now: Date): string {
  const date = fromDateKey(key);
  const label = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday", or e.g. "Wed, 12 Nov" (year added if not this year). */
export function formatDueDate(key: DateKey, now = new Date()): string {
  return relativeDayLabel(key, now) ?? absoluteDayLabel(key, now);
}

/** For use inside a sentence: "today", "tomorrow", "yesterday", or e.g. "on Wed, 12 Nov". */
export function formatDayPhrase(key: DateKey, now = new Date()): string {
  return relativeDayLabel(key, now)?.toLowerCase() ?? `on ${absoluteDayLabel(key, now)}`;
}

/**
 * For the screen header: the month in full and the year's last two digits, e.g.
 * { month: "November", year: "26" }. Kept apart so the year can be shown in a lighter color.
 */
export function headerMonth(key: DateKey): { month: string; year: string } {
  const date = fromDateKey(key);
  return {
    month: MONTHS_LONG[date.getMonth()],
    year: String(date.getFullYear() % 100).padStart(2, '0'),
  };
}

export function isOverdue(key: DateKey, now = new Date()): boolean {
  return key < toDateKey(now);
}

export function isToday(key: DateKey, now = new Date()): boolean {
  return key === toDateKey(now);
}

/** True for a well-formed "YYYY-MM-DD" string, e.g. one read back from a route param. */
export function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "12 Nov" */
export function formatDayMonth(key: DateKey): string {
  const date = fromDateKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Wed, 12 Nov" (year added if not this year), never "Today" / "Tomorrow". */
export function formatShortDate(key: DateKey, now = new Date()): string {
  return absoluteDayLabel(key, now);
}

/** "10 – 16 Nov", "28 Oct – 3 Nov", or "29 Dec 2026 – 4 Jan 2027" across a new year. */
export function formatDayRange(from: DateKey, to: DateKey): string {
  const start = fromDateKey(from);
  const end = fromDateKey(to);
  const endLabel = `${end.getDate()} ${MONTHS[end.getMonth()]}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${endLabel} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${endLabel}`;
  }
  return `${start.getDate()} – ${endLabel}`;
}

/** The coming Saturday, or today if it's already the weekend. */
export function thisWeekend(now: Date): Date {
  const day = now.getDay();
  return day === 0 || day === 6 ? now : addDays(now, 6 - day);
}

/** Monday of next week (tomorrow, if today is Sunday). */
export function nextWeek(now: Date): Date {
  return addDays(now, (8 - now.getDay()) % 7 || 7);
}

/** The quick choices in the due-date sheet. Each has its own color (see src/constants/dueDate.ts). */
export type DueDateKind = 'today' | 'tomorrow' | 'weekend' | 'nextWeek';

/**
 * Which quick choice `key` falls under, or null for a past day or one further out.
 * Today and Tomorrow come first, so a Saturday that's tomorrow counts as "tomorrow".
 * "This weekend" is the coming Saturday and Sunday; "next week" is the Monday to Sunday after it.
 */
export function getDueDateKind(key: DateKey, now = new Date()): DueDateKind | null {
  if (key === toDateKey(now)) return 'today';
  if (key === toDateKey(addDays(now, 1))) return 'tomorrow';

  const saturday = thisWeekend(now);
  if (key === toDateKey(saturday) || key === toDateKey(addDays(saturday, 1))) return 'weekend';

  const monday = nextWeek(now);
  if (key >= toDateKey(monday) && key <= toDateKey(addDays(monday, 6))) return 'nextWeek';

  return null;
}

/**
 * A time of day, 24-hour "HH:mm", e.g. "16:12".
 * Kept apart from the due date, so a todo can have a date with no time.
 */
export type TimeKey = string;

export function toTimeKey(hours: number, minutes: number): TimeKey {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTimeKey(key: TimeKey): { hours: number; minutes: number } {
  const [hours, minutes] = key.split(':').map(Number);
  return { hours, minutes };
}

export const MINUTES_PER_DAY = 24 * 60;

/** Minutes since midnight: "16:12" is 972. */
export function toDayMinutes(key: TimeKey): number {
  const { hours, minutes } = parseTimeKey(key);
  return hours * 60 + minutes;
}

/** The other way round: 972 is "16:12". */
export function fromDayMinutes(total: number): TimeKey {
  return toTimeKey(Math.floor(total / 60), total % 60);
}

/** True for a well-formed "HH:mm" string, e.g. one read back from a route param. */
export function isTimeKey(value: unknown): value is TimeKey {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** "4:12 pm" */
export function formatTime(key: TimeKey): string {
  const { hours, minutes } = parseTimeKey(key);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

/** An hour of the day (0–23) on its own: "12 am", "6 am", "12 pm". */
export function formatHour(hours: number): string {
  return `${hours % 12 || 12} ${hours < 12 ? 'am' : 'pm'}`;
}

/** "Today, 4:12 pm", or just "Today" when there's no time. */
export function formatDueDateTime(key: DateKey, time?: TimeKey, now = new Date()): string {
  const day = formatDueDate(key, now);
  return time ? `${day}, ${formatTime(time)}` : day;
}

/** Where the time picker starts: the next whole hour if `date` is today, otherwise 9:00 am. */
export function defaultTime(date: DateKey, now = new Date()): TimeKey {
  if (date !== toDateKey(now)) return '09:00';
  return toTimeKey(Math.min(now.getHours() + 1, 23), 0);
}

/** "Thursday, 12 November 2026", for screen readers. */
export function formatLongDate(key: DateKey): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** The first day of the month `key` falls in, e.g. "2026-11-01". */
export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** The first day of the month `months` after (or, if negative, before) the one `key` falls in. */
export function addMonths(key: DateKey, months: number): DateKey {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

/** "November 2026" */
export function formatMonthYear(key: DateKey): string {
  const date = fromDateKey(key);
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * The days of the month `key` falls in, as 6 weeks of 7 days, Sunday first.
 * Slots before the 1st and after the last day are null. Always 6 weeks, so a calendar
 * stays the same height from month to month.
 */
export function getMonthGrid(key: DateKey): (DateKey | null)[][] {
  const first = fromDateKey(startOfMonth(key));
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = first.getDay();

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - offset + 1;
      return day >= 1 && day <= daysInMonth ? toDateKey(new Date(year, month, day)) : null;
    }),
  );
}
