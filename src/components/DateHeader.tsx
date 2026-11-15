import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { formatLongDate, shortWeekday, toDateKey } from '@/lib/dates';

type Props = {
  date: Date;
  /** Shown on the right, level with the weekday, e.g. the timeline button. */
  action?: ReactNode;
};

/**
 * Screen header: the picked day's short weekday, big, with an optional button on the right.
 * Screen readers get the full date.
 */
export function DateHeader({ date, action }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 36 }]}>
      <Text
        style={styles.weekday}
        accessibilityRole="header"
        accessibilityLabel={formatLongDate(toDateKey(date))}
      >
        {shortWeekday(date)}
      </Text>
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
  weekday: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.text,
  },
});
