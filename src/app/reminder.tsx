import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetGrabber } from '@/components/SheetGrabber';
import { TimePicker } from '@/components/TimePicker';
import { colors } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { toAddSheetParams } from '@/lib/addSheetParams';
import {
  defaultTime,
  formatDayPhrase,
  formatTime,
  fromDayMinutes,
  isDateKey,
  isTimeKey,
  MINUTES_PER_DAY,
  toDayMinutes,
  type TimeKey,
} from '@/lib/dates';
import { earliestReminderMinute, ensureReminderPermission } from '@/lib/reminders';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos } from '@/store/todos';

/**
 * Sheet for picking when to get a reminder notification: a time on the todo's due date.
 * Opened from the add-todo sheet or a todo's details sheet (see src/app/_layout.tsx) with the
 * due date and the current reminder (`value`). From the add sheet, it hands the pick back as
 * the add sheet's `reminderTime` param. From the details sheet (`todoId` set), it saves it on
 * that todo and goes back.
 * Setting a reminder asks for notification permission, the first time.
 * Times that have already passed are faded in the picker and can't be picked.
 */
export default function ReminderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayKey } = useSelectedDate();
  const now = useNow();
  const { updateTodo } = useTodos();
  const params = useLocalSearchParams<{
    dueDate?: string;
    dueTime?: string;
    value?: string;
    todoId?: string;
  }>();
  const dueDate = isDateKey(params.dueDate) ? params.dueDate : todayKey;
  const dueTime = isTimeKey(params.dueTime) ? params.dueTime : undefined;
  const [initialValue] = useState(() => (isTimeKey(params.value) ? params.value : undefined));
  // Starts on the current reminder, else the due time, else the next whole hour (or 9:00 am).
  const [picked, setPicked] = useState<TimeKey>(
    () => initialValue ?? dueTime ?? defaultTime(dueDate, now),
  );
  const [saving, setSaving] = useState(false);

  // Nothing before the next minute can be picked. A time that's already passed (or passes
  // while the sheet is open) moves up to the earliest one left.
  const earliest = earliestReminderMinute(dueDate, now);
  const noneLeft = earliest >= MINUTES_PER_DAY;
  const time =
    noneLeft || toDayMinutes(picked) >= earliest ? picked : fromDayMinutes(earliest);

  const finish = (reminderTime?: TimeKey) => {
    if (params.todoId) {
      updateTodo(params.todoId, { reminderTime });
      router.back();
      return;
    }
    router.dismissTo({
      pathname: '/add',
      params: toAddSheetParams({ dueDate, dueTime, reminderTime }),
    });
  };

  const save = async () => {
    if (noneLeft || saving) return;
    setSaving(true);
    // Kept even if notifications aren't allowed: it's scheduled once they are.
    await ensureReminderPermission();
    finish(time);
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 24;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      // Lets the Android sheet expand first and then scroll, instead of fighting over the drag.
      nestedScrollEnabled
    >
      <SheetGrabber />
      <Text style={styles.heading} accessibilityRole="header">
        Reminder
      </Text>
      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {noneLeft
          ? 'This day is over. Pick a later due date to set a reminder.'
          : `You’ll get a notification ${formatDayPhrase(dueDate, now)} at ${formatTime(time)}.`}
      </Text>

      <TimePicker value={time} onChange={setPicked} earliest={earliest} />

      <Pressable
        onPress={save}
        disabled={noneLeft || saving}
        style={({ pressed }) => [
          styles.done,
          (noneLeft || saving) && styles.doneDisabled,
          pressed && styles.donePressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: noneLeft || saving }}
      >
        <Text style={styles.doneText}>Set reminder</Text>
      </Pressable>

      {initialValue ? (
        <Pressable
          onPress={() => finish(undefined)}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
          accessibilityRole="button"
        >
          <Text style={styles.removeText}>Remove reminder</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // Same as the due-date sheet.
  content: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  heading: {
    // Lines up with the time picker's captions, which sit 8px in.
    paddingHorizontal: 8,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  summary: {
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // Same as the due-date sheet's "Done" button.
  done: {
    marginTop: 20,
    marginHorizontal: 8,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePressed: {
    backgroundColor: colors.primaryPressed,
  },
  doneDisabled: {
    opacity: 0.4,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  remove: {
    marginTop: 8,
    marginHorizontal: 8,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: {
    backgroundColor: colors.inputBackground,
  },
  removeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
});
