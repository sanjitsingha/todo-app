import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TimePicker } from '@/components/TimePicker';
import { colors } from '@/constants/theme';
import { formatTime, type TimeKey } from '@/lib/dates';

type Props = {
  /** The picked time, or null for none. */
  value: TimeKey | null;
  onAdd: () => void;
  onChange: (time: TimeKey) => void;
  onRemove: () => void;
};

/**
 * The time part of the due-date sheet, below the calendar. With no time it's an "Add time"
 * button; with one it shows the time, a button to remove it, and the time picker.
 */
export function DueTimeField({ value, onAdd, onChange, onRemove }: Props) {
  if (value === null) {
    return (
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add time"
      >
        <Ionicons name="time-outline" size={22} color={colors.ink} />
        <Text style={styles.label}>Add time</Text>
        <Ionicons name="add" size={22} color={colors.iconInactive} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={22} color={colors.ink} />
        <Text style={styles.label}>Time</Text>
        <Text style={styles.value}>{formatTime(value)}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Remove time"
        >
          <Ionicons name="close-circle" size={22} color={colors.iconInactive} />
        </Pressable>
      </View>
      <TimePicker value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Same as the quick date choices above it.
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
});
