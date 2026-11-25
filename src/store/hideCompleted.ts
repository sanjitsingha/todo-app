import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'hideCompleted';

function load(): boolean {
  try {
    return Storage.getItemSync(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

let hideCompleted = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getHideCompleted(): boolean {
  return hideCompleted;
}

/**
 * Turns Hide completed todos (Profile › General) on or off. Kept on this phone only, as the
 * web app keeps it in each browser.
 */
export function setHideCompleted(next: boolean) {
  hideCompleted = next;
  try {
    Storage.setItemSync(STORAGE_KEY, String(next));
  } catch (error) {
    console.warn('Could not save Hide completed todos', error);
  }
  listeners.forEach((listener) => listener());
}

/**
 * Whether the Todo tab leaves out the day's done todos, in the list and the timeline. Off until
 * it's turned on.
 */
export function useHideCompleted(): boolean {
  return useSyncExternalStore(subscribe, getHideCompleted);
}
