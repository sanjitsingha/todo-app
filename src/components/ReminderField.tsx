import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Keyboard, Pressable, Text, View } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { formatTime, type DateKey, type TimeKey } from '@/lib/dates';
import { isReminderPast } from '@/lib/reminders';

type Props = {
  dueDate: DateKey;
  dueTime?: TimeKey;
  /** The reminder's time on the due date, if one is set. */
  value?: TimeKey;
  /** In minutes. Not shown here; passed through the reminder sheet so it survives the trip. */
  duration?: number;
};

/**
 * Reminder row in the add-todo sheet, below Duration: "Add time", or the reminder's time.
 * Tapping it opens the reminder sheet on top (src/app/reminder.tsx), which sends the pick
 * back as the add sheet's `reminderTime` param. A time that has already passed shows in red.
 */
export function ReminderField({ dueDate, dueTime, value, duration }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const isPast = value !== undefined && isReminderPast(dueDate, value);
  const label = value ? formatTime(value) : 'Add time';

  const open = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/reminder',
      params: {
        dueDate,
        ...(dueTime ? { dueTime } : {}),
        ...(value ? { value } : {}),
        ...(duration ? { duration: String(duration) } : {}),
      },
    });
  };

  return (
    <Pressable
      onPress={open}
      style={styles.row}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={
        value ? `Reminder, ${label}${isPast ? ', already passed' : ''}` : 'Reminder, none'
      }
      accessibilityHint="Opens a time picker for a reminder notification"
    >
      <View style={styles.label}>
        <Ionicons name="notifications-outline" size={20} color={colors.ink} />
        <Text style={styles.labelText}>Reminder</Text>
      </View>
      <View style={styles.value}>
        <Text
          style={[
            styles.valueText,
            !value && styles.valueTextEmpty,
            isPast && styles.valueTextPast,
          ]}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Same as the Due date row.
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
  valueTextEmpty: {
    fontWeight: '500',
    color: colors.textMuted,
  },
  valueTextPast: {
    color: colors.danger,
  },
}));
