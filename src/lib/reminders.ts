import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

import {
  formatTime,
  fromDateKey,
  MINUTES_PER_DAY,
  parseTimeKey,
  toDateKey,
  type DateKey,
  type TimeKey,
} from '@/lib/dates';
import type { Todo } from '@/store/todos';

const CHANNEL_ID = 'reminders';
// expo-notifications can't schedule anything on web.
const SUPPORTED = Platform.OS !== 'web';

if (SUPPORTED) {
  // Show a reminder that goes off while the app is open, too (otherwise it's dropped).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** When a reminder goes off: its time on the todo's due date. */
export function reminderDate(dueDate: DateKey, reminderTime: TimeKey): Date {
  const date = fromDateKey(dueDate);
  const { hours, minutes } = parseTimeKey(reminderTime);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function isReminderPast(dueDate: DateKey, reminderTime: TimeKey, now = Date.now()) {
  return reminderDate(dueDate, reminderTime).getTime() <= now;
}

/**
 * The earliest reminder that can still be set on `dueDate`, in minutes since midnight: the
 * next minute if it's today, 0 for a day still ahead, and MINUTES_PER_DAY (none left) for a
 * day that's over. Matches isReminderPast: the current minute counts as passed.
 */
export function earliestReminderMinute(dueDate: DateKey, now = new Date()): number {
  const todayKey = toDateKey(now);
  if (dueDate > todayKey) return 0;
  if (dueDate < todayKey) return MINUTES_PER_DAY;
  return now.getHours() * 60 + now.getMinutes() + 1;
}

let channelReady: Promise<boolean> | null = null;

/**
 * Creates the Android "Reminders" channel (once per launch), and resolves to whether it exists.
 * Never fails: Expo Go on Android rejects creating channels, and then reminders go to
 * expo-notifications' default channel instead, so they still show.
 */
function ensureChannel(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
    })
      .then(() => true)
      .catch((error) => {
        console.warn('Could not create the Reminders channel, using the default one', error);
        return false;
      });
  }
  return channelReady;
}

/**
 * Asks for permission to show notifications, if it hasn't been given yet. If the answer is no
 * (now or earlier), explains why reminders need it and offers to open the app's settings.
 * Resolves to whether reminders can be shown.
 */
export async function ensureReminderPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  // Made before asking, as Android 13+ expects; asking goes ahead even if it couldn't be.
  await ensureChannel();
  try {
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.granted) return true;
  } catch (error) {
    console.warn('Could not get notification permission', error);
    return false;
  }

  Alert.alert(
    'Notifications are off',
    'To get reminders, allow notifications for this app in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

let queue: Promise<void> = Promise.resolve();

/** The notification's text under the todo's name. It goes off on the due date, so "today". */
function reminderBody(todo: Todo): string {
  return todo.dueTime ? `Due today at ${formatTime(todo.dueTime)}` : 'Due today';
}

/**
 * Makes the scheduled notifications match the todos: one for each unfinished todo whose
 * reminder is still ahead, none for anything else (finished, removed, or past). Called whenever
 * the todos change. Runs one sync at a time, so quick changes can't schedule a reminder twice.
 */
export function syncReminders(todos: readonly Todo[]) {
  if (!SUPPORTED) return;
  queue = queue
    .then(() => sync(todos))
    .catch((error) => console.warn('Could not update reminders', error));
}

async function sync(todos: readonly Todo[]) {
  const now = Date.now();
  // Each todo's notification uses the todo's id as its identifier.
  const wanted = new Map<string, { todo: Todo; at: string }>();
  for (const todo of todos) {
    if (todo.completed || !todo.reminderTime) continue;
    const at = reminderDate(todo.dueDate, todo.reminderTime).getTime();
    if (at > now) wanted.set(todo.id, { todo, at: String(at) });
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    const match = wanted.get(request.identifier);
    if (
      match &&
      request.content.data?.at === match.at &&
      request.content.title === match.todo.title &&
      request.content.body === reminderBody(match.todo)
    ) {
      wanted.delete(request.identifier); // Already scheduled as it should be.
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  if (wanted.size === 0) return;
  // Without permission they'd never show; the next sync after it's given schedules them.
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  const hasChannel = await ensureChannel();

  for (const [id, { todo, at }] of wanted) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: todo.title,
        body: reminderBody(todo),
        data: { todoId: id, at },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: Number(at),
        // Left out when the channel couldn't be made, so the default channel is used.
        ...(hasChannel ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}
