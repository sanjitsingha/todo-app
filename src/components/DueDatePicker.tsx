import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Calendar } from '@/components/Calendar';
import { DUE_DATE_COLORS } from '@/constants/dueDate';
import { colors } from '@/constants/theme';
import {
  addDays,
  formatLongDate,
  formatShortDate,
  nextWeek,
  thisWeekend,
  toDateKey,
  type DateKey,
} from '@/lib/dates';

type IconName = 'today-outline' | 'sunny-outline' | 'cafe-outline' | 'arrow-forward-circle-outline';

type Props = {
  /** The picked day. */
  value: DateKey;
  /** The real current date. Days before it can't be picked. */
  today: Date;
  onSelect: (date: DateKey) => void;
};

/** Quick choices (Today, Tomorrow, This weekend, Next week) above a month calendar. */
export function DueDatePicker({ value, today, onSelect }: Props) {
  const todayKey = toDateKey(today);

  // Icon colors are shared with the date chips on todos.
  const quickChoices: { label: string; icon: IconName; color: string; date: DateKey }[] = [
    { label: 'Today', icon: 'today-outline', color: DUE_DATE_COLORS.today.icon, date: todayKey },
    {
      label: 'Tomorrow',
      icon: 'sunny-outline',
      color: DUE_DATE_COLORS.tomorrow.icon,
      date: toDateKey(addDays(today, 1)),
    },
    {
      label: 'This weekend',
      icon: 'cafe-outline',
      color: DUE_DATE_COLORS.weekend.icon,
      date: toDateKey(thisWeekend(today)),
    },
    {
      label: 'Next week',
      icon: 'arrow-forward-circle-outline',
      color: DUE_DATE_COLORS.nextWeek.icon,
      date: toDateKey(nextWeek(today)),
    },
  ];

  return (
    <View>
      {quickChoices.map((choice) => (
        <Pressable
          key={choice.label}
          onPress={() => onSelect(choice.date)}
          style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
          accessibilityRole="button"
          accessibilityLabel={`${choice.label}, ${formatLongDate(choice.date)}`}
        >
          <Ionicons name={choice.icon} size={22} color={choice.color} />
          <Text style={styles.choiceLabel}>{choice.label}</Text>
          <Text style={styles.choiceDate}>{formatShortDate(choice.date, today)}</Text>
        </Pressable>
      ))}

      <View style={styles.divider} />

      <Calendar value={value} today={todayKey} minDate={todayKey} onSelect={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  choicePressed: {
    backgroundColor: colors.inputBackground,
  },
  choiceLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  choiceDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    marginHorizontal: 8,
    backgroundColor: colors.border,
  },
});
