import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { formatLongDate, headerMonth, type DateKey } from '@/lib/dates';

type Props = {
  /** The picked day. */
  date: DateKey;
  /** Shown right after the month, e.g. the goal ring. */
  accessory?: ReactNode;
  /** Shown on the right, level with the month, e.g. the timeline button. */
  action?: ReactNode;
};

/**
 * Screen header: the picked day's month, big, then the year's last two digits in gray,
 * e.g. "November 26" (the date strip below already shows the weekday and date). An optional
 * accessory sits right after it and an optional button on the right. Screen readers get the
 * full date.
 */
export function DateHeader({ date, accessory, action }: Props) {
  const insets = useSafeAreaInsets();
  const { month, year } = headerMonth(date);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 36 }]}>
      <View style={styles.title}>
        <Text
          style={styles.month}
          // Long months like "September 26" shrink a little on narrow phones instead of wrapping.
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          accessibilityLabel={formatLongDate(date)}
        >
          {`${month} `}
          <Text style={styles.year}>{year}</Text>
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
  // The month and its accessory side by side; it gives way to the button on the right.
  title: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  month: {
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: colors.text,
  },
  // The same size and weight as the month, in gray.
  year: {
    color: colors.textMuted,
  },
});
