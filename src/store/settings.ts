import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * What each step of the date and time strips gives:
 * - `vibrate`: a firm vibration
 * - `tick`: a tick sound
 * - `tickVibrate`: a tick sound with a light vibration
 * - `none`: nothing
 */
export type FeedbackMode = 'vibrate' | 'tick' | 'tickVibrate' | 'none';

/** How the Todo screen shows the picked day's todos: a list, or a timeline by hour. */
export type TodoView = 'list' | 'timeline';

/**
 * The app's look: light, dark, or following the phone (src/hooks/useTheme.ts). Saved with the
 * other settings, so it follows the account to other phones.
 */
export type Appearance = 'light' | 'dark' | 'system';

export type Settings = {
  feedback: FeedbackMode;
  todoView: TodoView;
  appearance: Appearance;
};

const STORAGE_KEY = 'settings';
const DEFAULT_SETTINGS: Settings = {
  feedback: 'tickVibrate',
  todoView: 'list',
  appearance: 'system',
};

function isFeedbackMode(value: unknown): value is FeedbackMode {
  return value === 'vibrate' || value === 'tick' || value === 'tickVibrate' || value === 'none';
}

function isTodoView(value: unknown): value is TodoView {
  return value === 'list' || value === 'timeline';
}

function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'system';
}

function loadSettings(): Settings {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: Partial<Settings> = saved ? JSON.parse(saved) : {};
    return {
      feedback: isFeedbackMode(parsed.feedback) ? parsed.feedback : DEFAULT_SETTINGS.feedback,
      todoView: isTodoView(parsed.todoView) ? parsed.todoView : DEFAULT_SETTINGS.todoView,
      appearance: isAppearance(parsed.appearance)
        ? parsed.appearance
        : DEFAULT_SETTINGS.appearance,
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

function setSettings(next: Settings) {
  settings = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Could not save settings', error);
  }
  listeners.forEach((listener) => listener());
}

/** Changes some settings and saves them on the device (and, when signed in, in the account). */
export function updateSettings(changes: Partial<Settings>) {
  // Noted first, so anything the change re-renders already sees it waiting to be sent.
  setSettingsSync({ ...settingsSync, unsynced: true });
  setSettings({ ...settings, ...changes });
}

/**
 * Where the settings stand with the account (src/lib/settingsSync.ts): whose settings the phone
 * has (`userId`, once synced), and whether they've changed on the phone since.
 */
export type SettingsSync = { userId?: string; unsynced: boolean };

const SYNC_STORAGE_KEY = 'settings.sync';

function loadSettingsSync(): SettingsSync {
  try {
    const saved = Storage.getItemSync(SYNC_STORAGE_KEY);
    const parsed: Partial<SettingsSync> = saved ? JSON.parse(saved) : {};
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
      unsynced: parsed.unsynced === true,
    };
  } catch {
    return { unsynced: false };
  }
}

let settingsSync = loadSettingsSync();

export function getSettingsSync(): SettingsSync {
  return settingsSync;
}

export function setSettingsSync(next: SettingsSync) {
  settingsSync = next;
  try {
    Storage.setItemSync(SYNC_STORAGE_KEY, JSON.stringify(settingsSync));
  } catch (error) {
    console.warn('Could not save settings sync state', error);
  }
}

/** Takes on settings from `userId`'s account, without counting it as a change on the phone. */
export function applyAccountSettings(changes: Partial<Settings>, userId: string) {
  const next = {
    feedback: isFeedbackMode(changes.feedback) ? changes.feedback : settings.feedback,
    todoView: isTodoView(changes.todoView) ? changes.todoView : settings.todoView,
    appearance: isAppearance(changes.appearance) ? changes.appearance : settings.appearance,
  };
  if (
    next.feedback !== settings.feedback ||
    next.todoView !== settings.todoView ||
    next.appearance !== settings.appearance
  ) {
    setSettings(next);
  }
  setSettingsSync({ userId, unsynced: false });
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
