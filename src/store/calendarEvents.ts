import Storage from 'expo-sqlite/kv-store';
import { useMemo, useSyncExternalStore } from 'react';

import { addDays, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { getCalendar, refreshCalendar } from '@/store/calendar';

/** One of the person's Google Calendar events, as Dooist shows it (read-only). */
export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  allDay: boolean;
  /** All day: "YYYY-MM-DD" (the end day not included). Otherwise ISO times. */
  start: string;
  end: string;
};

type EventsState = {
  /** Whose events these are. */
  userId: string | null;
  events: CalendarEvent[];
};

type EventsResult = { events?: unknown[]; reason?: string; error?: string };

const STORAGE_KEY = 'calendar.events';
/** supabase/functions/google-calendar. */
const FUNCTION_NAME = 'google-calendar';
/** The events read: from this many days back… */
const DAYS_BACK = 7;
/** …to this many ahead, so Today and the days coming up have them. */
const DAYS_AHEAD = 90;

function isEvent(value: unknown): value is CalendarEvent {
  const event = value as Partial<CalendarEvent> | null;
  return (
    typeof event?.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.allDay === 'boolean' &&
    typeof event.start === 'string' &&
    typeof event.end === 'string'
  );
}

function load(): EventsState {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Partial<EventsState>) : {};
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      events: Array.isArray(parsed.events) ? parsed.events.filter(isEvent) : [],
    };
  } catch {
    return { userId: null, events: [] };
  }
}

// Saved on the phone, so the events show at once, and offline.
let state: EventsState = load();
const listeners = new Set<() => void>();

function setState(next: EventsState) {
  state = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Could not save the calendar events', error);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

/** Forgets the events, as when Events is switched off or Google Calendar disconnected. */
export function clearCalendarEvents() {
  if (state.events.length > 0 || state.userId !== null) setState({ userId: null, events: [] });
}

/**
 * Reads `userId`'s events from a week back to three months ahead, through the google-calendar
 * function, when Events is on; clears them when it's off. Throws if the network or the function
 * fails (what's saved keeps showing).
 */
export async function refreshCalendarEvents(userId: string) {
  if (!supabase) return;
  const calendar = getCalendar();
  if (calendar.userId !== userId || !calendar.connected || !calendar.showEvents) {
    clearCalendarEvents();
    return;
  }
  const today = new Date();
  const from = addDays(fromDateKey(toDateKey(today)), -DAYS_BACK);
  const to = addDays(fromDateKey(toDateKey(today)), DAYS_AHEAD);
  const { data, error } = await supabase.functions.invoke<EventsResult>(FUNCTION_NAME, {
    body: { action: 'events', from: from.toISOString(), to: to.toISOString() },
  });
  if (error) throw error;
  // The permission was taken back, or Events went off elsewhere: catch up with the switches.
  if (data?.reason) await refreshCalendar(userId).catch(() => {});
  setState({ userId, events: (data?.events ?? []).filter(isEvent) });
}

/** Whether `event` is on `date` (a day it starts on, ends on, or runs through). */
function isOnDay(event: CalendarEvent, date: DateKey): boolean {
  if (event.allDay) return event.start <= date && date < event.end;
  const dayStart = fromDateKey(date).getTime();
  const dayEnd = addDays(fromDateKey(date), 1).getTime();
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  // A zero-length event still shows on the day it's at.
  return start < dayEnd && (end > dayStart || start >= dayStart);
}

/** `userId`'s events on `date`: all-day ones first, then by start time. Re-renders when they change. */
export function useDayEvents(date: DateKey, userId: string | null): CalendarEvent[] {
  const current = useSyncExternalStore(subscribe, getState);
  return useMemo(() => {
    if (!userId || current.userId !== userId) return [];
    return current.events
      .filter((event) => isOnDay(event, date))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return Date.parse(a.start) - Date.parse(b.start);
      });
  }, [current, date, userId]);
}
