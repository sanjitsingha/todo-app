import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncSettings } from '@/lib/settingsSync';
import { syncTodos } from '@/lib/todoSync';
import { useAuth } from '@/store/auth';
import { syncGoogleCalendar } from '@/store/calendar';
import { refreshCalendarEvents } from '@/store/calendarEvents';
import { getSettingsSync, useSettings } from '@/store/settings';
import { useTodos } from '@/store/todos';

/** After a change on the phone, wait this long, so a quick run of changes goes up together. */
const CHANGE_DELAY_MS = 1500;

// One sync at a time. Asking while one runs runs one more after it, for the latest account.
let running = false;
let wanted: string | null = null;

async function runSyncs() {
  if (running) return;
  running = true;
  try {
    while (wanted) {
      const userId = wanted;
      wanted = null;
      try {
        await syncTodos(userId);
        await syncSettings(userId);
      } catch (error) {
        // Offline, most likely. Nothing is lost: it's all on the phone, marked to send.
        console.warn('Could not sync with your account; will try again later.', error);
        break;
      }
      // After the todos are up, so the server sends Google the latest. Its own failures don't
      // stop the account's syncing: the server remembers how far it got.
      try {
        await syncGoogleCalendar(userId);
      } catch (error) {
        console.warn('Could not update Google Calendar; will try again later.', error);
      }
      // The person's own events, for Today, when Events is on (cleared when it's off).
      try {
        await refreshCalendarEvents(userId);
      } catch (error) {
        console.warn('Could not load calendar events; will try again later.', error);
      }
    }
  } finally {
    running = false;
  }
}

function requestSync(userId: string) {
  wanted = userId;
  void runSyncs();
}

/**
 * Keeps the phone and the signed-in account in step (todos: src/lib/todoSync.ts, settings:
 * src/lib/settingsSync.ts), then has the todos sent on to Google Calendar when that's
 * connected (src/store/calendar.ts), and loads the person's events when Events is on
 * (src/store/calendarEvents.ts). It syncs on signing in (or opening the app signed in), on
 * coming back to the app, and shortly after anything changes on the phone. Signed out, it does
 * nothing. Draws nothing.
 */
export function CloudSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { todos } = useTodos();
  const settings = useSettings();

  useEffect(() => {
    if (userId) requestSync(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync(userId);
    });
    return () => subscription.remove();
  }, [userId]);

  // Anything not sent yet: todos changed here, todos not the account's yet, or settings.
  const waiting =
    userId !== null &&
    (todos.some((todo) => todo.unsynced || todo.userId !== userId) || getSettingsSync().unsynced);

  // Restarts the wait on every change (`todos`, `settings`), so it fires once things settle.
  useEffect(() => {
    if (!userId || !waiting) return;
    const timer = setTimeout(() => requestSync(userId), CHANGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, waiting, todos, settings]);

  return null;
}
