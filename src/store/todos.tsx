import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { isDuration } from '@/constants/duration';
import { deadlineOf, isTimeKey, type DateKey, type TimeKey } from '@/lib/dates';
import { syncReminders } from '@/lib/reminders';

export type Priority = 'high' | 'medium' | 'low';

export type Todo = {
  id: string;
  title: string;
  /** Shown in the todo's details sheet. */
  description?: string;
  dueDate: DateKey;
  /** Time of day on the due date, if one was set. */
  dueTime?: TimeKey;
  /** Time of day on the due date to get a notification, if one was set. */
  reminderTime?: TimeKey;
  /** How long it takes, in minutes, if set. */
  duration?: number;
  priority: Priority;
  completed: boolean;
  /**
   * When it was marked done, while it is, for the Stats tab's On time card. Set on every done
   * todo: ones finished before this was noted get one when loaded (see assumedFinishTime).
   */
  completedAt?: number;
  createdAt: number;
  /**
   * The account it belongs to, once it has been synced (src/lib/todoSync.ts). None for a todo
   * made while signed out: the next account to sign in on this phone takes it.
   */
  userId?: string;
  /** Changed on the phone since it was last sent to the account. */
  unsynced?: boolean;
  /** When it last changed, on the phone or in the account. */
  updatedAt?: number;
};

export type NewTodo = Pick<
  Todo,
  'title' | 'description' | 'dueDate' | 'dueTime' | 'reminderTime' | 'duration' | 'priority'
>;

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

/** What can be changed on a saved todo. A key set to undefined clears that value. */
export type TodoChanges = Partial<NewTodo>;

type TodosValue = {
  todos: Todo[];
  addTodo: (todo: NewTodo) => void;
  updateTodo: (id: string, changes: TodoChanges) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
};

const STORAGE_KEY = 'todos';

/**
 * A finish time for a todo marked done before the app noted when. There's no telling when it
 * was done, so it's taken as done on time: now, if the deadline is still ahead (so it surely
 * was), otherwise just before the deadline. Saved with the rest, so it's worked out once.
 */
function assumedFinishTime(todo: Todo, now: number): number {
  const deadline = deadlineOf(todo);
  return Number.isFinite(deadline) ? Math.min(now, deadline - 1) : now;
}

function loadTodos(): Todo[] {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    // Todos saved before "completed" / "priority" existed don't have those fields yet.
    return parsed.map((stored: Todo) => {
      const todo: Todo = {
        ...stored,
        completed: stored.completed === true,
        completedAt: undefined,
        priority: isPriority(stored.priority) ? stored.priority : 'medium',
        dueTime: isTimeKey(stored.dueTime) ? stored.dueTime : undefined,
        reminderTime: isTimeKey(stored.reminderTime) ? stored.reminderTime : undefined,
        duration: isDuration(stored.duration) ? stored.duration : undefined,
        userId: typeof stored.userId === 'string' ? stored.userId : undefined,
        unsynced: stored.unsynced === true,
        updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : undefined,
      };
      if (todo.completed) {
        todo.completedAt =
          typeof stored.completedAt === 'number'
            ? stored.completedAt
            : assumedFinishTime(todo, now);
      }
      return todo;
    });
  } catch (error) {
    console.warn('Could not load saved todos', error);
    return [];
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// A plain module store rather than React state, so syncing (src/lib/todoSync.ts) can read and
// change the todos between network calls, outside any component.
let todos: Todo[] = loadTodos();
const listeners = new Set<() => void>();

/** The todos as they are right now. */
export function getTodos(): Todo[] {
  return todos;
}

/**
 * Changes the todos, saves them on the phone, and brings the reminders in step: scheduled for
 * new todos, cancelled when one is finished or gone, scheduled again when it's un-finished (if
 * the time is still ahead). An update that returns the same list changes nothing.
 */
export function updateTodos(update: (current: Todo[]) => Todo[]) {
  const next = update(todos);
  if (next === todos) return;
  todos = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.warn('Could not save todos', error);
  }
  syncReminders(todos);
  listeners.forEach((listener) => listener());
}

/**
 * Todos deleted on the phone that the account doesn't know about yet: the next sync marks them
 * deleted there (src/lib/todoSync.ts), so they go from the user's other phones and Google
 * Calendar too, and won't come back from the account meanwhile. Saved on the phone, so a
 * deletion made offline still reaches the account later.
 */
export type DeletedTodo = { id: string; userId: string };

const DELETED_STORAGE_KEY = 'todos.deleted';

function loadDeleted(): DeletedTodo[] {
  try {
    const saved = Storage.getItemSync(DELETED_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is DeletedTodo =>
            typeof entry?.id === 'string' && typeof entry?.userId === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

let deletedTodos = loadDeleted();

function saveDeleted(next: DeletedTodo[]) {
  deletedTodos = next;
  try {
    Storage.setItemSync(DELETED_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Could not save deleted todos', error);
  }
}

/** Deleted todos still to be marked deleted in the account. */
export function getDeletedTodos(): readonly DeletedTodo[] {
  return deletedTodos;
}

/** Forgets deletions the account now has. */
export function forgetDeletedTodos(ids: ReadonlySet<string>) {
  if (deletedTodos.some((entry) => ids.has(entry.id))) {
    saveDeleted(deletedTodos.filter((entry) => !ids.has(entry.id)));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A todo with a change made on the phone, to be sent to the account. */
function changed(todo: Todo): Todo {
  return { ...todo, unsynced: true, updatedAt: Date.now() };
}

function addTodo(todo: NewTodo) {
  const now = Date.now();
  updateTodos((current) => [
    ...current,
    { ...todo, id: createId(), completed: false, createdAt: now, unsynced: true, updatedAt: now },
  ]);
}

function updateTodo(id: string, changes: TodoChanges) {
  updateTodos((current) =>
    current.map((todo) => (todo.id === id ? changed({ ...todo, ...changes }) : todo)),
  );
}

/**
 * Deletes a todo: it goes from the phone at once (and its reminder with it). One that's in an
 * account is noted, so the next sync deletes it there too (getDeletedTodos).
 */
function deleteTodo(id: string) {
  const todo = todos.find((candidate) => candidate.id === id);
  if (!todo) return;
  if (todo.userId) saveDeleted([...deletedTodos, { id, userId: todo.userId }]);
  updateTodos((current) => current.filter((candidate) => candidate.id !== id));
}

// Marking a todo done notes when, for the Stats tab's On time card; undoing it clears that.
function toggleTodo(id: string) {
  const now = Date.now();
  updateTodos((current) =>
    current.map((todo) => {
      if (todo.id !== id) return todo;
      return changed(
        todo.completed
          ? { ...todo, completed: false, completedAt: undefined }
          : { ...todo, completed: true, completedAt: now },
      );
    }),
  );
}

/**
 * Schedules the reminders for the saved todos when the app starts. The todos themselves live in
 * the store above, saved on the phone, so they survive closing the app.
 */
export function TodosProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    syncReminders(getTodos());
  }, []);
  return children;
}

/** The todo list, and the ways to change it. Re-renders when the todos change. */
export function useTodos(): TodosValue {
  const current = useSyncExternalStore(subscribe, getTodos);
  return useMemo(
    () => ({ todos: current, addTodo, updateTodo, toggleTodo, deleteTodo }),
    [current],
  );
}
