import { isDuration } from '@/constants/duration';
import type { DateKey, TimeKey } from '@/lib/dates';

/**
 * What the add-todo sheet (src/app/add.tsx) gets back from the sheets it opens (due date,
 * reminder, duration). Coming back replaces all of its params instead of merging them, so each
 * sheet hands back every value, passing through the ones it didn't change.
 */
export type AddSheetParams = {
  dueDate: DateKey;
  dueTime?: TimeKey;
  reminderTime?: TimeKey;
  /** In minutes. */
  duration?: number;
};

/** Leaves out the unset values, so they come back as unset rather than as empty strings. */
export function toAddSheetParams({ dueDate, dueTime, reminderTime, duration }: AddSheetParams) {
  return {
    dueDate,
    ...(dueTime ? { dueTime } : {}),
    ...(reminderTime ? { reminderTime } : {}),
    ...(duration ? { duration: String(duration) } : {}),
  };
}

/** A duration read back from a route param (they're strings), or undefined if there's none. */
export function parseDurationParam(value: string | undefined): number | undefined {
  const minutes = Number(value);
  return isDuration(minutes) ? minutes : undefined;
}
