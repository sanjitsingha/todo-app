import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DurationPicker } from '@/components/DurationPicker';
import { SheetGrabber } from '@/components/SheetGrabber';
import { createThemedStyles } from '@/hooks/useTheme';
import { parseDurationParam, toAddSheetParams } from '@/lib/addSheetParams';
import { isDateKey, isTimeKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';

/** Where the picker starts when no duration is set yet, in minutes. */
const DEFAULT_DURATION = 30;

/**
 * Sheet for picking how long a todo takes, in hours and minutes. Opened from the add-todo
 * sheet (see src/app/_layout.tsx) with the current duration (`value`), and the add sheet's
 * other picks to pass back through. It hands the pick back as the add sheet's `duration` param.
 */
export default function DurationScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayKey } = useSelectedDate();
  const params = useLocalSearchParams<{
    dueDate?: string;
    dueTime?: string;
    reminderTime?: string;
    value?: string;
  }>();
  const dueDate = isDateKey(params.dueDate) ? params.dueDate : todayKey;
  const dueTime = isTimeKey(params.dueTime) ? params.dueTime : undefined;
  const reminderTime = isTimeKey(params.reminderTime) ? params.reminderTime : undefined;
  const [initialValue] = useState(() => parseDurationParam(params.value));
  const [picked, setPicked] = useState(initialValue ?? DEFAULT_DURATION);

  // 0 hours 0 minutes isn't a duration.
  const canSet = picked > 0;

  const finish = (duration?: number) => {
    router.dismissTo({
      pathname: '/add',
      params: toAddSheetParams({ dueDate, dueTime, reminderTime, duration }),
    });
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
        Duration
      </Text>
      <DurationPicker value={picked} onChange={setPicked} />

      <Pressable
        onPress={() => canSet && finish(picked)}
        disabled={!canSet}
        style={({ pressed }) => [
          styles.done,
          !canSet && styles.doneDisabled,
          pressed && styles.donePressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSet }}
      >
        <Text style={styles.doneText}>Set duration</Text>
      </Pressable>

      {initialValue ? (
        <Pressable
          onPress={() => finish(undefined)}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
          accessibilityRole="button"
        >
          <Text style={styles.removeText}>Remove duration</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

// The same as the reminder sheet (src/app/reminder.tsx).
const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  heading: {
    // Lines up with the picker's captions, which sit 8px in.
    paddingHorizontal: 8,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
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
}));
