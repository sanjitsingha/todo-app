import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { formatHeaderDay, formatLongDate, type DateKey } from '@/lib/dates';

type Props = {
  /** The picked day. */
  date: DateKey;
  /** The real current date, to tell today and yesterday apart from other days. */
  today: Date;
  /** Shown right after the day, e.g. the goal ring. */
  accessory?: ReactNode;
  /** Shown on the right, level with the day, e.g. the timeline button. */
  action?: ReactNode;
};

/**
 * Screen header: the picked day, big — "Today", "Yesterday", or the weekday, e.g. "Wednesday" —
 * with an optional accessory right after it and an optional button on the right. Screen readers
 * get the full date.
 */
export function DateHeader({ date, today, accessory, action }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 36 }]}>
      <View style={styles.title}>
        <Text
          style={styles.day}
          // Long names like "Wednesday" shrink a little on narrow phones instead of wrapping.
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          accessibilityLabel={formatLongDate(date)}
        >
          {formatHeaderDay(date, today)}
        </Text>
        {accessory}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // The day and its accessory side by side; it gives way to the button on the right.
  title: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  day: {
    flexShrink: 1,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.text,
  },
});
