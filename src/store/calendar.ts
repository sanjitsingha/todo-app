import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';

import { CALENDAR_CALLBACK_PATH } from '@/constants/links';
import { appLink, BROWSER_RETURN_OPTIONS } from '@/lib/appLink';
import { supabase } from '@/lib/supabase';

/**
 * Why sending todos to Google Calendar stopped by itself: the access was removed in the Google
 * account (or ran out), or the Dooist calendar was deleted in Google Calendar.
 */
export type CalendarProblem = 'revoked' | 'calendar_deleted';

export type CalendarState = {
  /** The account this is about. Anyone else signed in counts as not connected. */
  userId: string | null;
  connected: boolean;
  /** The Google account the todos go to. */
  email?: string;
  /** Set when it stopped by itself, so the Calendar page offers to reconnect. */
  problem?: CalendarProblem;
  /** Todo sync: todos go to the Dooist calendar. On unless switched off. */
  syncTodos: boolean;
  /** Events: the person's Google Calendar events show in Dooist (src/store/calendarEvents.ts). */
  showEvents: boolean;
  /** Google gave Dooist permission to read events. */
  canReadEvents: boolean;
};

type SyncResult = { connected: boolean; more?: boolean; reason?: string | null };
type ConnectResult = { url?: string; error?: string };
type SettingsResult = { ok?: boolean; error?: string };

const STORAGE_KEY = 'calendar';
/** supabase/functions/google-calendar. */
const FUNCTION_NAME = 'google-calendar';
/** Sync calls in one go at most. Each sends up to 100 todos; the rest go next time. */
const MAX_ROUNDS = 20;

const NOT_SET_UP = 'Google Calendar isn’t set up yet.';
const OFFLINE = 'Couldn’t reach the server. Check your internet connection and try again.';
const FAILED = 'Something went wrong. Please try again.';
const NEEDS_PERMISSION =
  'Dooist needs permission to make and manage its own calendar. Try again, and leave the Google Calendar box ticked.';
const NEEDS_EVENTS_PERMISSION =
  'To show your events, Dooist needs permission to see them. Try again, and leave that box ticked.';

const NOT_CONNECTED: Omit<CalendarState, 'userId'> = {
  connected: false,
  syncTodos: true,
  showEvents: false,
  canReadEvents: false,
};

function isProblem(value: unknown): value is CalendarProblem {
  return value === 'revoked' || value === 'calendar_deleted';
}

function load(): CalendarState {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: Partial<CalendarState> = saved ? JSON.parse(saved) : {};
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      connected: parsed.connected === true,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      problem: isProblem(parsed.problem) ? parsed.problem : undefined,
      syncTodos: parsed.syncTodos !== false,
      showEvents: parsed.showEvents === true,
      canReadEvents: parsed.canReadEvents === true,
    };
  } catch (error) {
    console.warn('Could not load the Google Calendar state', error);
    return { userId: null, ...NOT_CONNECTED };
  }
}

// Saved on the phone too, so Profile and the Calendar page show the right thing at once.
let state: CalendarState = load();
const listeners = new Set<() => void>();

function sameState(a: CalendarState, b: CalendarState): boolean {
  return (
    a.userId === b.userId &&
    a.connected === b.connected &&
    a.email === b.email &&
    a.problem === b.problem &&
    a.syncTodos === b.syncTodos &&
    a.showEvents === b.showEvents &&
    a.canReadEvents === b.canReadEvents
  );
}

function setState(next: CalendarState) {
  if (sameState(next, state)) return;
  state = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Could not save the Google Calendar state', error);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The Google Calendar state right now, outside React. */
export function getCalendar(): CalendarState {
  return state;
}

/** The Google Calendar connection and its switches. Re-renders when they change. */
export function useCalendar(): CalendarState {
  return useSyncExternalStore(subscribe, getCalendar);
}

/**
 * Reads `userId`'s Google Calendar connection and switches from the account: connecting can
 * happen on another phone, and Google can take the access back. Throws if the account can't be
 * reached. A project without the calendar table yet (its migration not run) counts as not
 * connected.
 */
export async function refreshCalendar(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('connected, google_email, last_error, sync_todos, show_events, can_read_events')
    .eq('user_id', userId)
    .maybeSingle();
  // PGRST205: no such table.
  if (error && error.code !== 'PGRST205') throw error;
  const connected = data?.connected === true;
  setState({
    userId,
    connected,
    email: connected ? (data?.google_email ?? undefined) : undefined,
    problem: !connected && isProblem(data?.last_error) ? data.last_error : undefined,
    syncTodos: data?.sync_todos !== false,
    showEvents: connected && data?.show_events === true,
    canReadEvents: connected && data?.can_read_events === true,
  });
}

/**
 * Has the server send `userId`'s changed todos on to Google Calendar, when it's connected
 * (src/components/CloudSync.tsx calls it after each sync with the account, so the server has
 * the latest). With Todo sync off, the server sends nothing. Throws if the network or the
 * function fails; the next sync tries again.
 */
export async function syncGoogleCalendar(userId: string) {
  if (!supabase) return;
  await refreshCalendar(userId);
  if (state.userId !== userId || !state.connected || !state.syncTodos) return;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.functions.invoke<SyncResult>(FUNCTION_NAME, {
      body: { action: 'sync' },
    });
    if (error) throw error;
    // It stopped by itself (access removed, or the calendar deleted): show that.
    if (!data?.connected) {
      await refreshCalendar(userId);
      return;
    }
    if (!data.more) return;
  }
}

/**
 * `message`, plus what exactly went wrong while developing (Expo Go, development builds), so
 * a failed setup step shows up on the phone. Release builds show just the message.
 */
function withDetail(message: string, detail: unknown): string {
  if (!__DEV__ || detail == null || detail === '') return message;
  return `${message}\n\n(${String(detail)})`;
}

/** A failed function call as a short sentence for an alert. */
function describe(error: unknown): string {
  if (error instanceof FunctionsFetchError) return OFFLINE;
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    // The function isn't deployed yet.
    if (status === 404) return NOT_SET_UP;
    // 401: the function didn't accept the sign-in. 500: it failed (its logs say why).
    return withDetail(FAILED, `server said ${status}`);
  }
  return withDetail(FAILED, error instanceof Error ? error.message : error);
}

/** The first value of a link's query parameter. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function phoneTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Connects Google Calendar for `userId`: Google's consent page opens in the in-app browser
 * (through the google-calendar function), and when it's allowed, the server makes a "Dooist"
 * calendar in that Google account and starts sending the todos to it. `withEvents` (from the
 * Events switch) also asks to read the person's events, and turns Events on once allowed.
 * Gives back what went wrong, ready for an alert, or null (connected, or the browser was
 * closed).
 */
export async function connectGoogleCalendar(
  userId: string,
  { withEvents = false }: { withEvents?: boolean } = {},
): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  try {
    const redirectTo = appLink(CALENDAR_CALLBACK_PATH);
    const { data, error } = await supabase.functions.invoke<ConnectResult>(FUNCTION_NAME, {
      body: { action: 'connect', redirectTo, timeZone: phoneTimeZone(), withEvents },
    });
    if (error) return describe(error);
    if (!data?.url) {
      return data?.error === 'not_configured'
        ? NOT_SET_UP
        : withDetail(FAILED, `connect: ${data?.error ?? 'no link'}, back to ${redirectTo}`);
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
      BROWSER_RETURN_OPTIONS,
    );
    if (result.type !== 'success') return null;

    const { queryParams } = Linking.parse(result.url);
    const outcome = firstParam(queryParams?.calendar);
    if (outcome === 'cancelled') return null;
    if (outcome !== 'connected') {
      const reason = firstParam(queryParams?.reason);
      // exchange: Google didn't swap the code for tokens. calendar: Google wouldn't make the
      // Dooist calendar (is the Calendar API on?). no_refresh_token, no_code: see the function.
      return reason === 'scope'
        ? NEEDS_PERMISSION
        : withDetail(FAILED, `after Google: ${reason ?? outcome ?? 'no answer'}`);
    }

    setState({ ...state, userId, connected: true, problem: undefined });
    // The email and switches, as the server now has them.
    await refreshCalendar(userId).catch(() => {});
    // Sends the todos now rather than at the next change.
    syncGoogleCalendar(userId).catch((syncError) => {
      console.warn('Could not send todos to Google Calendar yet; will try again later.', syncError);
    });
    return firstParam(queryParams?.events) === 'denied' ? NEEDS_EVENTS_PERMISSION : null;
  } catch (error) {
    console.warn('Could not connect Google Calendar', error);
    return withDetail(FAILED, error instanceof Error ? error.message : error);
  }
}

/**
 * Stops sending `userId`'s todos to Google Calendar, and hands the access back to Google. The
 * Dooist calendar and its events stay in Google Calendar. Gives back what went wrong, or null.
 */
export async function disconnectGoogleCalendar(userId: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'disconnect' },
    });
    if (error) return describe(error);
    setState({ ...state, userId, ...NOT_CONNECTED, email: undefined, problem: undefined });
    return null;
  } catch (error) {
    console.warn('Could not disconnect Google Calendar', error);
    return FAILED;
  }
}

/**
 * Sends every one of `userId`'s todos to Google Calendar again, from the start: for when
 * something there looks out of step. Gives back what went wrong, or null.
 */
export async function resyncGoogleCalendar(userId: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'resync' },
    });
    if (error) return describe(error);
    await syncGoogleCalendar(userId);
    return null;
  } catch (error) {
    return describe(error);
  }
}

/** Saves one of the Calendar page's switches on the server. */
async function saveSetting(changes: { syncTodos?: boolean; showEvents?: boolean }) {
  if (!supabase) return { error: NOT_SET_UP };
  const { data, error } = await supabase.functions.invoke<SettingsResult>(FUNCTION_NAME, {
    body: { action: 'settings', ...changes },
  });
  if (error) return { error: describe(error) };
  return { result: data };
}

/**
 * Todo sync on or off. Off, new changes stay in Dooist and what's in Google Calendar stays;
 * back on, everything is sent again. Gives back what went wrong, or null.
 */
export async function setTodoSync(userId: string, enabled: boolean): Promise<string | null> {
  const before = state;
  setState({ ...state, syncTodos: enabled });
  try {
    const saved = await saveSetting({ syncTodos: enabled });
    if (saved.error || saved.result?.error) {
      setState(before);
      return saved.error ?? FAILED;
    }
    if (enabled) {
      syncGoogleCalendar(userId).catch((syncError) => {
        console.warn('Could not send todos to Google Calendar yet; will try again later.', syncError);
      });
    }
    return null;
  } catch (error) {
    setState(before);
    return describe(error);
  }
}

/**
 * Events on or off. The first time it's turned on, Google is asked for permission to read the
 * person's events (the consent page opens again); after that it just switches. Gives back what
 * went wrong, or null. The events themselves load through src/store/calendarEvents.ts.
 */
export async function setShowEvents(userId: string, enabled: boolean): Promise<string | null> {
  if (enabled && !state.canReadEvents) {
    return connectGoogleCalendar(userId, { withEvents: true });
  }
  const before = state;
  setState({ ...state, showEvents: enabled });
  try {
    const saved = await saveSetting({ showEvents: enabled });
    if (saved.result?.error === 'needs_permission') {
      setState({ ...before, canReadEvents: false });
      return connectGoogleCalendar(userId, { withEvents: true });
    }
    if (saved.error || saved.result?.error) {
      setState(before);
      return saved.error ?? FAILED;
    }
    return null;
  } catch (error) {
    setState(before);
    return describe(error);
  }
}
