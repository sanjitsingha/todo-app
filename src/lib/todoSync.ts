import Storage from 'expo-sqlite/kv-store';

import type { TodoInsert, TodoRow } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import {
  forgetDeletedTodos,
  getDeletedTodos,
  getTodos,
  updateTodos,
  type Todo,
} from '@/store/todos';

/** Rows asked for or sent in one request. */
const PAGE_SIZE = 500;
/**
 * Each pull asks again for a little before the newest change it saw last time, in case a
 * change was saved just as the last pull ran. Seeing a row twice does no harm.
 */
const PULL_OVERLAP_MS = 10_000;

/** Where the newest change pulled from each account is noted, on the phone. */
const pulledKey = (userId: string) => `sync.todos.pulledAt.${userId}`;

function toRow(todo: Todo, userId: string): TodoInsert {
  const createdAt = Number.isFinite(todo.createdAt) ? todo.createdAt : Date.now();
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    description: todo.description ?? null,
    due_date: todo.dueDate,
    due_time: todo.dueTime ?? null,
    reminder_time: todo.reminderTime ?? null,
    duration: todo.duration ?? null,
    priority: todo.priority,
    completed: todo.completed,
    completed_at:
      todo.completed && todo.completedAt !== undefined
        ? new Date(todo.completedAt).toISOString()
        : null,
    created_at: new Date(createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromRow(row: TodoRow): Todo {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date,
    dueTime: row.due_time ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    duration: row.duration ?? undefined,
    priority: row.priority,
    completed: row.completed,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    unsynced: false,
  };
}

/** True when two copies of a todo say the same thing, whatever their sync bookkeeping. */
function sameTodo(a: Todo, b: Todo): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.dueDate === b.dueDate &&
    a.dueTime === b.dueTime &&
    a.reminderTime === b.reminderTime &&
    a.duration === b.duration &&
    a.priority === b.priority &&
    a.completed === b.completed &&
    a.completedAt === b.completedAt &&
    a.createdAt === b.createdAt &&
    a.userId === b.userId
  );
}

/**
 * Makes the phone's todos `userId`'s: todos made while signed out become theirs, and todos
 * another account left on the phone (signing out keeps them) are taken off it. They're safe in
 * that account; they aren't mixed into this one.
 */
function claimTodos(userId: string) {
  updateTodos((current) => {
    if (current.every((todo) => todo.userId === userId)) return current;
    return current
      .filter((todo) => todo.userId === undefined || todo.userId === userId)
      .map((todo) =>
        todo.userId === undefined
          ? { ...todo, userId, unsynced: true, updatedAt: Date.now() }
          : todo,
      );
  });
}

/** Sends the todos changed on the phone to the account. */
async function pushTodos(userId: string) {
  if (!supabase) return;
  const waiting = getTodos().filter((todo) => todo.userId === userId && todo.unsynced);

  for (let start = 0; start < waiting.length; start += PAGE_SIZE) {
    const batch = waiting.slice(start, start + PAGE_SIZE);
    const { error } = await supabase
      .from('todos')
      .upsert(
        batch.map((todo) => toRow(todo, userId)),
        { onConflict: 'user_id,id' },
      );
    if (error) throw error;

    // Sent, unless it changed again while this was on its way: then it goes next time.
    const sent = new Map(batch.map((todo) => [todo.id, todo.updatedAt]));
    updateTodos((current) => {
      let any = false;
      const next = current.map((todo) => {
        if (todo.userId !== userId || !todo.unsynced || !sent.has(todo.id)) return todo;
        if (sent.get(todo.id) !== todo.updatedAt) return todo;
        any = true;
        return { ...todo, unsynced: false };
      });
      return any ? next : current;
    });
  }
}

/**
 * Marks the todos deleted on the phone as deleted in the account (`deleted_at`), which is how
 * the user's other phones and the Google Calendar sync hear of it. One that never reached the
 * account matches no row, which is fine.
 */
async function pushDeletions(userId: string) {
  if (!supabase) return;
  const waiting = getDeletedTodos().filter((entry) => entry.userId === userId);
  for (let start = 0; start < waiting.length; start += PAGE_SIZE) {
    const ids = waiting.slice(start, start + PAGE_SIZE).map((entry) => entry.id);
    const { error } = await supabase
      .from('todos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', ids);
    if (error) throw error;
    forgetDeletedTodos(new Set(ids));
  }
}

/**
 * Brings in what changed in the account since the last pull: from the user's other phones, or
 * everything on the first pull. A todo changed on the phone and not sent yet keeps the phone's
 * version (it's sent next); one deleted in the account goes from the phone too.
 */
async function pullTodos(userId: string) {
  if (!supabase) return;
  const saved = Storage.getItemSync(pulledKey(userId));
  const since = saved ? Number(saved) : null;

  const rows: TodoRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase.from('todos').select('*').eq('user_id', userId);
    if (since !== null && Number.isFinite(since)) {
      query = query.gt('updated_at', new Date(since - PULL_OVERLAP_MS).toISOString());
    }
    const { data, error } = await query
      .order('updated_at', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  if (rows.length === 0) return;

  // Deleted on the phone, and not marked deleted in the account yet: they stay gone.
  const deletedHere = new Set(getDeletedTodos().map((entry) => entry.id));
  updateTodos((current) => {
    const byId = new Map(current.map((todo) => [todo.id, todo]));
    let any = false;
    for (const row of rows) {
      if (deletedHere.has(row.id)) continue;
      const local = byId.get(row.id);
      if (local?.unsynced && local.userId === userId) continue;
      if (row.deleted_at) {
        if (local) {
          byId.delete(row.id);
          any = true;
        }
        continue;
      }
      const remote = fromRow(row);
      if (local && sameTodo(local, remote)) continue;
      byId.set(row.id, remote);
      any = true;
    }
    return any ? [...byId.values()] : current;
  });

  const newest = Math.max(...rows.map((row) => Date.parse(row.updated_at)));
  if (Number.isFinite(newest)) Storage.setItemSync(pulledKey(userId), String(newest));
}

/**
 * Makes the phone's todos and `userId`'s account agree: claims the phone's todos for the
 * account, sends what changed on the phone, then brings in what changed elsewhere. The phone
 * stays the place the app reads from, so it all works offline; this catches up when it can.
 * Throws if the network or Supabase fails partway; the next sync picks up where it stopped.
 */
export async function syncTodos(userId: string) {
  if (!supabase) return;
  claimTodos(userId);
  await pushTodos(userId);
  await pushDeletions(userId);
  await pullTodos(userId);
}
