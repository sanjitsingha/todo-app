import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DueDatePicker } from '@/components/DueDatePicker';
import { DueTimeField } from '@/components/DueTimeField';
import { SheetGrabber } from '@/components/SheetGrabber';
import { colors } from '@/constants/theme';
import { toAddSheetParams } from '@/lib/addSheetParams';
import { defaultTime, isDateKey, isTimeKey, type DateKey, type TimeKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';

/**
 * Sheet for picking a todo's due date and, optionally, a time. Opened from the add-todo sheet
 * (see src/app/_layout.tsx); opens part way up and can be dragged to full screen.
 * Gets the current pick as `value` / `time` and hands the new one back as the add sheet's
 * `dueDate` / `dueTime` params.
 *
 * Tapping a day closes the sheet right away, taking the time along if one is set.
 * "Done" (there once a time is involved) keeps the day and saves the time.
 */
export default function DueDateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { today, todayKey } = useSelectedDate();
  const params = useLocalSearchParams<{ value?: string; time?: string; reminderTime?: string }>();
  const current = isDateKey(params.value) && params.value >= todayKey ? params.value : todayKey;
  // Not changed here; handed back as is (see src/lib/addSheetParams.ts).
  const reminderTime = isTimeKey(params.reminderTime) ? params.reminderTime : undefined;
  const [initialTime] = useState(() => (isTimeKey(params.time) ? params.time : null));
  const [time, setTime] = useState<TimeKey | null>(initialTime);

  const scrollRef = useRef<ScrollViewInstance>(null);
  // Set when the picker opens, so the sheet scrolls it into view once it has rendered.
  const revealPicker = useRef(false);

  const finish = (date: DateKey) => {
    // The add sheet's params are replaced, not merged, so leaving out dueTime clears it.
    router.dismissTo({
      pathname: '/add',
      params: toAddSheetParams({ dueDate: date, dueTime: time ?? undefined, reminderTime }),
    });
  };

  const addTime = () => {
    revealPicker.current = true;
    setTime(defaultTime(current, today));
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 24;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      // Lets the Android sheet expand first and then scroll, instead of fighting over the drag.
      nestedScrollEnabled
      onContentSizeChange={() => {
        if (!revealPicker.current) return;
        revealPicker.current = false;
        scrollRef.current?.scrollToEnd({ animated: true });
      }}
    >
      <SheetGrabber />
      <Text style={styles.heading} accessibilityRole="header">
        Due date
      </Text>
      <DueDatePicker value={current} today={today} onSelect={finish} />

      <View style={styles.divider} />

      <DueTimeField
        value={time}
        onAdd={addTime}
        onChange={setTime}
        onRemove={() => setTime(null)}
      />

      {time !== null || initialTime !== null ? (
        <Pressable
          onPress={() => finish(current)}
          style={({ pressed }) => [styles.done, pressed && styles.donePressed]}
          accessibilityRole="button"
        >
          <Text style={styles.doneText}>Done</Text>
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
  content: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  heading: {
    // Lines up with the choices' icons, which sit 8px in.
    paddingHorizontal: 8,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  // Same as the one between the quick choices and the calendar.
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    marginHorizontal: 8,
    backgroundColor: colors.border,
  },
  // Same as the "Add todo" button.
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
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
