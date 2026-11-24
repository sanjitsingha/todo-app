import type { TodoRow } from '@/lib/database.types';
import { addDays, formatShortDate, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';
import type { Todo } from '@/store/todos';

/**
 * The Reporting tab's log of what happened to your todos, the same as the web app's
 * (lib/activity.ts there), so both read the same.
 */

/** The columns of a todo the log is read from. */
export type ActivityRow = Pick<
  TodoRow,
  'id' | 'title' | 'created_at' | 'updated_at' | 'completed' | 'completed_at' | 'deleted_at'
>;

export type ActivityKind = 'added' | 'updated' | 'completed' | 'deleted';
/** Marking a todo not done leaves no trace in the account, so it has no activity to show. */
export type ReportType = ActivityKind | 'uncompleted';
/** Any date, a range, or an exact day. */
export type DateChoice = 'any' | 'today' | 'week' | 'month' | DateKey;

export type ActivityEvent = {
  id: string;
  todoId: string;
  kind: ActivityKind;
  title: string;
  /** When it happened, as a timestamp. */
  at: number;
};

/** What one todo's history is told from, as timestamps. */
type TodoHistory = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** While it's done. */
  completedAt?: number;
  deletedAt?: number;
};

/** A save this close to adding, completing or deleting is part of that, not a separate edit. */
const SAME_CHANGE_MS = 60_000;

function fromRow(row: ActivityRow): TodoHistory {
  return {
    id: row.id,
    title: row.title,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    completedAt: row.completed && row.completed_at ? Date.parse(row.completed_at) : undefined,
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : undefined,
  };
}

function fromTodo(todo: Todo): TodoHistory {
  return {
    id: todo.id,
    title: todo.title,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt ?? todo.createdAt,
    completedAt: todo.completed ? todo.completedAt : undefined,
  };
}

/**
 * The account's todos, with the phone's copy in place of each one it has: the phone's is the
 * newest (it can have changes not sent yet), and it also has the todos not sent at all. The
 * account adds the deleted ones, which the phone doesn't keep. A todo deleted elsewhere that's
 * still on the phone (it goes at the next sync) counts as deleted, unless it was changed here
 * since: then the phone's copy wins, as it does when syncing.
 */
export function mergeHistory(rows: readonly ActivityRow[], todos: readonly Todo[]): TodoHistory[] {
  const byId = new Map(rows.map((row) => [row.id, fromRow(row)]));
  for (const todo of todos) {
    if (byId.get(todo.id)?.deletedAt !== undefined && !todo.unsynced) continue;
    byId.set(todo.id, fromTodo(todo));
  }
  return [...byId.values()];
}

/**
 * The history the todos can tell: when each was added, completed and deleted, and its latest
 * edit. Earlier edits aren't kept anywhere. Newest first.
 */
export function buildActivity(history: readonly TodoHistory[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const todo of history) {
    const known: number[] = [];
    const push = (kind: ActivityKind, at: number | undefined) => {
      if (at === undefined || !Number.isFinite(at)) return;
      known.push(at);
      events.push({ id: `${todo.id}:${kind}`, todoId: todo.id, kind, title: todo.title, at });
    };

    push('added', todo.createdAt);
    push('completed', todo.completedAt);
    push('deleted', todo.deletedAt);
    const updated = todo.updatedAt;
    if (Number.isFinite(updated) && known.every((at) => Math.abs(updated - at) > SAME_CHANGE_MS)) {
      push('updated', updated);
    }
  }
  return events.sort((a, b) => b.at - a.at);
}

/** "This week" runs Sunday to Saturday, like the calendar. */
export function matchesDate(at: number, choice: DateChoice, today: DateKey): boolean {
  const day = toDateKey(new Date(at));
  if (choice === 'any') return true;
  if (choice === 'today') return day === today;
  if (choice === 'month') return day.slice(0, 7) === today.slice(0, 7);
  if (choice === 'week') {
    const now = fromDateKey(today);
    const sunday = addDays(now, -now.getDay());
    return day >= toDateKey(sunday) && day <= toDateKey(addDays(sunday, 6));
  }
  return day === choice;
}

/** Events in order, under the day each happened. */
export function groupByDay(events: readonly ActivityEvent[]) {
  const days = new Map<DateKey, ActivityEvent[]>();
  for (const event of events) {
    const day = toDateKey(new Date(event.at));
    const list = days.get(day);
    if (list) list.push(event);
    else days.set(day, [event]);
  }
  return [...days].map(([day, items]) => ({ day, items }));
}

/** "Any date", "Today", "This week", "This month", or the day, e.g. "Wed, 12 Nov". */
export function dateChoiceSummary(choice: DateChoice, today: DateKey): string {
  switch (choice) {
    case 'any':
      return 'Any date';
    case 'today':
      return 'Today';
    case 'week':
      return 'This week';
    case 'month':
      return 'This month';
    default:
      return formatShortDate(choice, fromDateKey(today));
  }
}
