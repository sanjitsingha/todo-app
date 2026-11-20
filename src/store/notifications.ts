import { useSyncExternalStore } from 'react';

/** What a notification is about; it sets the icon and its color on the Notifications page. */
export type NotificationKind = 'reminder' | 'due' | 'done' | 'calendar' | 'update';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** When it came, in milliseconds (Date.now()). */
  at: number;
  read: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A few made-up notifications, so the Notifications page has something to show while it's
 * being built. Only while developing (Expo Go, development builds): release builds and updates
 * start empty, until notifications come from the app and the account.
 */
function sampleNotifications(now: number): AppNotification[] {
  return [
    {
      id: 'sample-1',
      kind: 'reminder',
      title: 'Reminder: Call the bank',
      body: 'Due today at 4:00 pm.',
      at: now - 12 * MINUTE,
      read: false,
    },
    {
      id: 'sample-2',
      kind: 'due',
      title: '3 todos due today',
      body: 'Pay rent, Gym, and Call the bank.',
      at: now - 3 * HOUR,
      read: false,
    },
    {
      id: 'sample-3',
      kind: 'done',
      title: 'All done yesterday',
      body: 'You finished all 5 of your todos. Nice work!',
      at: now - DAY - 2 * HOUR,
      read: true,
    },
    {
      id: 'sample-4',
      kind: 'calendar',
      title: 'Google Calendar connected',
      body: 'Your todos now show in the Dooist calendar.',
      at: now - 3 * DAY,
      read: true,
    },
    {
      id: 'sample-5',
      kind: 'update',
      title: 'Dooist has a new look',
      body: 'Try dark mode: Profile, then Appearance.',
      at: now - 6 * DAY,
      read: true,
    },
  ];
}

// A plain module store, like the settings: the bell in Profile's header and the Notifications
// page read the same list. Kept in memory only for now; nothing is saved or sent anywhere.
let notifications: readonly AppNotification[] = __DEV__ ? sampleNotifications(Date.now()) : [];
const listeners = new Set<() => void>();

function setNotifications(next: readonly AppNotification[]) {
  notifications = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getNotifications() {
  return notifications;
}

/** Every notification, newest first; re-renders when they change. */
export function useNotifications(): readonly AppNotification[] {
  return useSyncExternalStore(subscribe, getNotifications);
}

/** How many haven't been read yet, for the bell's dot. */
export function useUnreadCount(): number {
  return useNotifications().filter((notification) => !notification.read).length;
}

export function markNotificationRead(id: string) {
  if (!notifications.some((notification) => notification.id === id && !notification.read)) return;
  setNotifications(
    notifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    ),
  );
}

export function markAllNotificationsRead() {
  if (notifications.every((notification) => notification.read)) return;
  setNotifications(notifications.map((notification) => ({ ...notification, read: true })));
}
