import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { getHeaderDateParts } from '@/lib/dates';

/** Screen header: big short weekday on the left, month + day and year on the right. */
export function DateHeader({ date }: { date: Date }) {
  const insets = useSafeAreaInsets();
  const { weekday, monthDay, year } = getHeaderDateParts(date);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 36 }]} accessibilityRole="header">
      <Text style={styles.weekday}>{weekday}</Text>
      <View>
        <Text style={styles.date}>{monthDay}</Text>
        <Text style={styles.date}>{year}</Text>
      </View>
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
  date: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '500',
    color: colors.textSubtle,
    textAlign: 'right',
  },
});
