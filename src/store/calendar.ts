import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';

import { CALENDAR_CALLBACK_PATH } from '@/constants/links';
import { appLink } from '@/lib/appLink';
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
  /** Set when it stopped by itself, so Profile offers to reconnect. */
  problem?: CalendarProblem;
};

type SyncResult = { connected: boolean; more?: boolean; reason?: string | null };
type ConnectResult = { url?: string; error?: string };

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
    };
  } catch (error) {
    console.warn('Could not load the Google Calendar state', error);
    return { userId: null, connected: false };
  }
}

// Saved on the phone too, so Profile shows Connected at once when the app opens.
let state: CalendarState = load();
const listeners = new Set<() => void>();

function setState(next: CalendarState) {
  if (
    next.userId === state.userId &&
    next.connected === state.connected &&
    next.email === state.email &&
    next.problem === state.problem
  ) {
    return;
  }
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

function getCalendar(): CalendarState {
  return state;
}

/** Whether todos go to Google Calendar, for the Profile row. Re-renders when it changes. */
export function useCalendar(): CalendarState {
  return useSyncExternalStore(subscribe, getCalendar);
}

/**
 * Reads whether `userId` has Google Calendar connected, from the account: connecting can happen
 * on another phone, and Google can take the access back. Throws if the account can't be
 * reached. A project without the calendar table yet (its migration not run) counts as not
 * connected.
 */
export async function refreshCalendar(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('connected, google_email, last_error')
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
  });
}

/**
 * Has the server send `userId`'s changed todos on to Google Calendar, when it's connected
 * (src/components/CloudSync.tsx calls it after each sync with the account, so the server has
 * the latest). Throws if the network or the function fails; the next sync tries again.
 */
export async function syncGoogleCalendar(userId: string) {
  if (!supabase) return;
  await refreshCalendar(userId);
  if (state.userId !== userId || !state.connected) return;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.functions.invoke<SyncResult>(FUNCTION_NAME, {
      body: { action: 'sync' },
    });
    if (error) throw error;
    // It stopped by itself (access removed, or the calendar deleted): show that in Profile.
    if (!data?.connected) {
      await refreshCalendar(userId);
      return;
    }
    if (!data.more) return;
  }
}

/** A failed function call as a short sentence for an alert. */
function describe(error: unknown): string {
  if (error instanceof FunctionsFetchError) return OFFLINE;
  // The function isn't deployed yet.
  if (error instanceof FunctionsHttpError && error.context.status === 404) return NOT_SET_UP;
  return FAILED;
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
 * calendar in that Google account and starts sending the todos to it. Gives back what went
 * wrong, ready for an alert, or null (connected, or the browser was closed).
 */
export async function connectGoogleCalendar(userId: string): Promise<string | null> {
  if (!supabase) return NOT_SET_UP;
  try {
    const redirectTo = appLink(CALENDAR_CALLBACK_PATH);
    const { data, error } = await supabase.functions.invoke<ConnectResult>(FUNCTION_NAME, {
      body: { action: 'connect', redirectTo, timeZone: phoneTimeZone() },
    });
    if (error) return describe(error);
    if (!data?.url) return data?.error === 'not_configured' ? NOT_SET_UP : FAILED;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null;

    const { queryParams } = Linking.parse(result.url);
    const outcome = firstParam(queryParams?.calendar);
    if (outcome === 'cancelled') return null;
    if (outcome !== 'connected') {
      return firstParam(queryParams?.reason) === 'scope' ? NEEDS_PERMISSION : FAILED;
    }

    setState({ userId, connected: true });
    // Sends the todos now rather than at the next change. Picks up the Google email too.
    syncGoogleCalendar(userId).catch((syncError) => {
      console.warn('Could not send todos to Google Calendar yet; will try again later.', syncError);
    });
    return null;
  } catch (error) {
    console.warn('Could not connect Google Calendar', error);
    return FAILED;
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
    setState({ userId, connected: false });
    return null;
  } catch (error) {
    console.warn('Could not disconnect Google Calendar', error);
    return FAILED;
  }
}
