import { useCallback, useEffect, useRef, useState } from 'react';

import { syncWithAccount } from '@/components/CloudSync';
import { fetchRecentlyDeleted, type RecentlyDeletedTodo } from '@/lib/todoSync';
import { getTodos, useTodos, type Todo } from '@/store/todos';

/** How far back Recently deleted goes. Older deletes stay in the account, for its history. */
export const RECENTLY_DELETED_DAYS = 30;

/**
 * The account's todos deleted in the last 30 days, the latest first, for Profile › General.
 * Loaded once the phone has synced, so a todo deleted here a moment ago is in the list.
 * Restoring one takes it out of the list at once and puts it back on the phone; the next sync
 * brings it back in the account.
 */
export function useRecentlyDeleted(userId: string | null) {
  const { restoreTodo } = useTodos();
  const [deleted, setDeleted] = useState<RecentlyDeletedTodo[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const latest = useRef(0);

  const load = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    const run = ++latest.current;
    return syncWithAccount(userId)
      .then(() => fetchRecentlyDeleted(userId, RECENTLY_DELETED_DAYS))
      .then(
        (next) => {
          if (run !== latest.current) return;
          // Restored on the phone but not in the account yet (offline): it's back, so not listed.
          const onPhone = new Set(getTodos().map((todo) => todo.id));
          setDeleted(next.filter(({ todo }) => !onPhone.has(todo.id)));
          setStatus('ready');
        },
        () => {
          // A failed reload keeps what's on screen.
          if (run !== latest.current) return;
          setStatus((current) => (current === 'ready' ? current : 'error'));
        },
      );
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  const restore = useCallback(
    (todo: Todo) => {
      setDeleted((current) => current.filter((entry) => entry.todo.id !== todo.id));
      restoreTodo(todo);
      void load();
    },
    [load, restoreTodo],
  );

  return { deleted, status, retry, restore };
}
