import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * What each step of the date and time strips gives:
 * - `vibrate`: a firm vibration
 * - `tick`: a tick sound
 * - `tickVibrate`: a tick sound with a light vibration
 */
export type FeedbackMode = 'vibrate' | 'tick' | 'tickVibrate';

/** How the Todo screen shows the picked day's todos: a list, or a timeline by hour. */
export type TodoView = 'list' | 'timeline';

export type Settings = {
  feedback: FeedbackMode;
  todoView: TodoView;
};

const STORAGE_KEY = 'settings';
const DEFAULT_SETTINGS: Settings = { feedback: 'tickVibrate', todoView: 'list' };

function isFeedbackMode(value: unknown): value is FeedbackMode {
  return value === 'vibrate' || value === 'tick' || value === 'tickVibrate';
}

function isTodoView(value: unknown): value is TodoView {
  return value === 'list' || value === 'timeline';
}

function loadSettings(): Settings {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: Partial<Settings> = saved ? JSON.parse(saved) : {};
    return {
      feedback: isFeedbackMode(parsed.feedback) ? parsed.feedback : DEFAULT_SETTINGS.feedback,
      todoView: isTodoView(parsed.todoView) ? parsed.todoView : DEFAULT_SETTINGS.todoView,
    };
  } catch (error) {
    console.warn('Could not load settings', error);
    return DEFAULT_SETTINGS;
  }
}

// A plain module store, not a React context: the tick feedback runs in scroll listeners,
// outside React, and has to read the current settings there.
let settings = loadSettings();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return settings;
}

/** Changes some settings and saves them on the device. */
export function updateSettings(changes: Partial<Settings>) {
  settings = { ...settings, ...changes };
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Could not save settings', error);
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current settings; re-renders when they change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeToSettings, getSettings);
}
