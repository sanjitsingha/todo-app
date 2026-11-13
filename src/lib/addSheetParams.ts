import type { DateKey, TimeKey } from '@/lib/dates';

/**
 * What the add-todo sheet (src/app/add.tsx) gets back from the sheets it opens (due date,
 * reminder). Coming back replaces all of its params instead of merging them, so each sheet
 * hands back every value, passing through the ones it didn't change.
 */
export type AddSheetParams = {
  dueDate: DateKey;
  dueTime?: TimeKey;
  reminderTime?: TimeKey;
};

/** Leaves out the unset values, so they come back as unset rather than as empty strings. */
export function toAddSheetParams({ dueDate, dueTime, reminderTime }: AddSheetParams) {
  return {
    dueDate,
    ...(dueTime ? { dueTime } : {}),
    ...(reminderTime ? { reminderTime } : {}),
  };
}
