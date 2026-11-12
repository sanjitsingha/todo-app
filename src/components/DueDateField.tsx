import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatDueDate, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';

type Props = {
  value: DateKey;
  onChange: (value: DateKey) => void;
};

/**
 * Due date row. On Android, tapping it opens the system date dialog.
 * On iOS, it shows the native compact date button.
 */
export function DueDateField({ value, onChange }: Props) {
  const date = fromDateKey(value);
  const today = fromDateKey(toDateKey(new Date()));

  const handleChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    onChange(toDateKey(selected));
  };

  const label = (
    <View style={styles.label}>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      <Text style={styles.labelText}>Due date</Text>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        {label}
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          minimumDate={today}
          onValueChange={handleChange}
        />
      </View>
    );
  }

  const openPicker = () => {
    Keyboard.dismiss();
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      minimumDate: today,
      onValueChange: handleChange,
    });
  };

  return (
    <Pressable
      onPress={openPicker}
      style={styles.row}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={`Due date, ${formatDueDate(value)}`}
      accessibilityHint="Opens a date picker"
    >
      {label}
      <View style={styles.value}>
        <Text style={styles.valueText}>{formatDueDate(value)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
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
    color: colors.primary,
  },
});
