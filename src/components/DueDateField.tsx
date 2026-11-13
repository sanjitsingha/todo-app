import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatDueDateTime, type DateKey, type TimeKey } from '@/lib/dates';

type Props = {
  value: DateKey;
  time?: TimeKey;
  /** Not shown here; passed through the due-date sheet so it survives the trip. */
  reminderTime?: TimeKey;
};

/**
 * Due date row in the add-todo sheet, e.g. "Today, 4:12 pm". Tapping it opens the due-date
 * sheet on top (src/app/due-date.tsx), which sends the pick back as the add sheet's
 * `dueDate` / `dueTime` params.
 */
export function DueDateField({ value, time, reminderTime }: Props) {
  const router = useRouter();
  const label = formatDueDateTime(value, time);

  const open = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/due-date',
      params: { value, ...(time ? { time } : {}), ...(reminderTime ? { reminderTime } : {}) },
    });
  };

  return (
    <Pressable
      onPress={open}
      style={styles.row}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={`Due date, ${label}`}
      accessibilityHint="Opens date options, a calendar, and a time picker"
    >
      <View style={styles.label}>
        <Ionicons name="calendar-outline" size={20} color={colors.ink} />
        <Text style={styles.labelText}>Due date</Text>
      </View>
      <View style={styles.value}>
        <Text style={styles.valueText}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Plain row, like the text fields above it.
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelText: {
    fontSize: 16,
    color: colors.text,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
});
