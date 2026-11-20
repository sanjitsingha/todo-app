import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Keyboard, Pressable, Text, View } from 'react-native';

import { formatDuration } from '@/constants/duration';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { DateKey, TimeKey } from '@/lib/dates';

type Props = {
  /** In minutes, if set. */
  value?: number;
  /** Not shown here; passed through the duration sheet so they survive the trip. */
  dueDate: DateKey;
  dueTime?: TimeKey;
  reminderTime?: TimeKey;
};

/**
 * Duration row in the add-todo sheet, above Reminder: "Add duration", or how long it takes,
 * e.g. "1 hr 30 min". Tapping it opens the duration sheet on top (src/app/duration.tsx), with
 * hours and minutes strips, which sends the pick back as the add sheet's `duration` param.
 */
export function DurationField({ value, dueDate, dueTime, reminderTime }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const label = value ? formatDuration(value) : 'Add duration';

  const open = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/duration',
      params: {
        dueDate,
        ...(dueTime ? { dueTime } : {}),
        ...(reminderTime ? { reminderTime } : {}),
        ...(value ? { value: String(value) } : {}),
      },
    });
  };

  return (
    <Pressable
      onPress={open}
      style={styles.row}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={value ? `Duration, ${label}` : 'Duration, none'}
      accessibilityHint="Opens hours and minutes pickers"
    >
      <View style={styles.label}>
        <Ionicons name="hourglass-outline" size={20} color={colors.ink} />
        <Text style={styles.labelText}>Duration</Text>
      </View>
      <View style={styles.value}>
        <Text style={[styles.valueText, !value && styles.valueTextEmpty]}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
      </View>
    </Pressable>
  );
}

// The same as the Reminder row below it.
const useStyles = createThemedStyles((colors) => ({
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
}));
