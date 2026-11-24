import { useRouter } from 'expo-router';
// Just these icons, not the whole icon set.
import CalendarIcon from 'lucide-react-native/icons/calendar';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Calendar } from '@/components/Calendar';
import { Radio, type Choice } from '@/components/ChoiceSheet';
import { SheetGrabber } from '@/components/SheetGrabber';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { DateChoice } from '@/lib/activity';
import { isDateKey, type DateKey } from '@/lib/dates';
import { setReportFilters, useReportFilters } from '@/store/reportFilters';
import { useSelectedDate } from '@/store/selectedDate';

/** After picking a range, the sheet stays this long, so the radio is seen moving, then closes. */
const CLOSE_DELAY_MS = 250;
const ICON_SIZE = 20;

const RANGES: readonly Choice<'today' | 'week' | 'month' | 'any'>[] = [
  { value: 'today', label: 'Today', icon: CalendarCheck },
  { value: 'week', label: 'This week', icon: CalendarRange },
  { value: 'month', label: 'This month', icon: CalendarDays },
  { value: 'any', label: 'Any date', icon: CalendarIcon },
];

/**
 * Sheet for which dates the Reporting tab shows, opened from its Date filter: Today, This week
 * (Sunday to Saturday), This month or Any date, or a day picked on the calendar under them.
 * Picking one closes the sheet. Opens part way up; drag up for full screen.
 */
export default function ReportDateScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayKey } = useSelectedDate();
  const { date } = useReportFilters();
  const pickedDay = date === 'today' ? todayKey : isDateKey(date) ? date : null;

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const pickRange = (next: DateChoice) => {
    setReportFilters({ date: next });
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => router.back(), CLOSE_DELAY_MS);
  };

  // Today's date is kept as "today", so it moves on at midnight like the rest of the app.
  const pickDay = (day: DateKey) => {
    setReportFilters({ date: day === todayKey ? 'today' : day });
    router.back();
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
        Date
      </Text>

      <View accessibilityRole="radiogroup" accessibilityLabel="Date">
        {RANGES.map(({ value, label, icon: Icon }) => {
          const selected = date === value;
          return (
            <Pressable
              key={value}
              onPress={() => pickRange(value)}
              style={({ pressed }) => [
                styles.option,
                // Android shows a ripple instead.
                pressed && Platform.OS !== 'android' && styles.optionPressed,
              ]}
              android_ripple={{ color: colors.ripple }}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
            >
              {Icon ? <Icon size={ICON_SIZE} color={colors.ink} /> : null}
              <Text style={styles.optionText}>{label}</Text>
              <Radio selected={selected} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.calendar}>
        <Calendar value={pickedDay} today={todayKey} onSelect={pickDay} />
      </View>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  // As in src/components/ChoiceSheet.tsx.
  heading: {
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  option: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionPressed: {
    backgroundColor: colors.inputBackground,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: 20,
    backgroundColor: colors.border,
  },
  // As in the due-date sheet.
  calendar: {
    paddingHorizontal: 12,
  },
}));
