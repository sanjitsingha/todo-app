const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

/** Pieces for the screen header, e.g. { weekday: "Thu", monthDay: "February 13", year: "2025" }. */
export function getHeaderDateParts(date: Date) {
  return {
    weekday: shortWeekday(date),
    monthDay: `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`,
    year: String(date.getFullYear()),
  };
}

export function isOverdue(key: DateKey, now = new Date()): boolean {
  return key < toDateKey(now);
}
