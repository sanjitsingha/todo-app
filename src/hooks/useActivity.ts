import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildActivity, mergeHistory, type ActivityRow } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { useTodos } from '@/store/todos';

/** Rows asked for in one request. */
const PAGE_SIZE = 500;
const COLUMNS = 'id,title,created_at,updated_at,completed,completed_at,deleted_at';
/**
 * After a change on the phone, how long to wait before asking the account again: long enough
 * for the change to be sent (src/components/CloudSync.tsx waits 1.5 s, then sends it).
 */
const RELOAD_DELAY_MS = 4000;

/** Every one of the account's todos, deleted ones too, since a delete is part of the history. */
async function fetchRows(userId: string): Promise<ActivityRow[]> {
  if (!supabase) return [];
  const rows: ActivityRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('todos')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('id')
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/**
 * `loading` until the account has answered once, then `ready`. `offline` when it couldn't be
 * reached before that: the log then has only what's on the phone, so todos deleted on another
 * device are missing.
 */
export type ActivityStatus = 'loading' | 'ready' | 'offline';

/**
 * The account's activity, newest first. The phone's own todos show straight away (and changes
 * to them at once); the account adds the deleted ones and anything the phone hasn't pulled
 * yet. It asks the account each time the tab comes into view, and again shortly after the
 * todos change while it's open.
 */
export function useActivity(userId: string | null) {
  const { todos } = useTodos();
  const focused = useIsFocused();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [status, setStatus] = useState<ActivityStatus>(supabase ? 'loading' : 'ready');
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback((): Promise<void> => {
    if (!userId || !supabase) return Promise.resolve();
    const run = ++latest.current;
    return fetchRows(userId).then(
      (next) => {
        if (run !== latest.current) return;
        setRows(next);
        setStatus('ready');
      },
      () => {
        // A failed reload keeps what's on screen; the phone's own todos are still up to date.
        if (run !== latest.current) return;
        setStatus((current) => (current === 'ready' ? current : 'offline'));
      },
    );
  }, [userId]);

  useEffect(() => {
    if (focused) void load();
  }, [focused, load]);

  // A change made here shows at once. Asking the account again once it's sent brings in what
  // syncing changed besides, like a todo deleted on the web leaving the phone. Changes while
  // the tab is out of view need nothing: coming back into view asks anyway.
  const seenTodos = useRef(todos);
  useEffect(() => {
    const changed = todos !== seenTodos.current;
    seenTodos.current = todos;
    if (!focused || !changed) return;
    const timer = setTimeout(() => void load(), RELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, todos, load]);

  /** For pull to refresh. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const events = useMemo(() => {
    // The phone's todos are this account's once synced; ones made signed out are claimed by it.
    const mine = todos.filter((todo) => todo.userId === userId || todo.userId === undefined);
    return buildActivity(mergeHistory(rows, mine));
  }, [rows, todos, userId]);

  return { events, status, refreshing, refresh };
}
