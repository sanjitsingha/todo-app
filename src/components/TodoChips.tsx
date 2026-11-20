import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { dueDateColors } from '@/constants/dueDate';
import { priorityLevels } from '@/constants/priority';
import type { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/useTheme';
import { formatDueDateTime, formatTime, getDueDateKind, isOverdue } from '@/lib/dates';
import type { Todo } from '@/store/todos';

/** `small` in the todo list, `medium` in the todo's details sheet. */
type ChipSize = 'small' | 'medium';

type ChipProps = {
  todo: Todo;
  size?: ChipSize;
};

/** "Overdue · Wed, 11 Nov" or e.g. "Today, 4:12 pm". */
export function dueLabel(todo: Todo): string {
  const label = formatDueDateTime(todo.dueDate, todo.dueTime);
  return !todo.completed && isOverdue(todo.dueDate) ? `Overdue · ${label}` : label;
}

/** The todo's priority level, with its label and colors in `colors` (useColors). */
export function priorityOf(todo: Todo, colors: ThemeColors) {
  const levels = priorityLevels(colors);
  return levels.find((level) => level.value === todo.priority) ?? levels[1];
}

/**
 * The todo's due date (and time). Today, Tomorrow, This weekend and Next week get a chip in the
 * same color as their choice in the due-date sheet. Other days, and finished todos, show the
 * date as plain gray text, and overdue ones in red.
 */
export function DueDateChip({ todo, size = 'small' }: ChipProps) {
  const colors = useColors();
  const overdue = !todo.completed && isOverdue(todo.dueDate);
  const kind = todo.completed ? null : getDueDateKind(todo.dueDate);
  const chip = kind ? dueDateColors(colors)[kind] : null;
  const color = overdue ? colors.danger : chip ? chip.text : colors.textMuted;
  const sizes = SIZES[size];

  return (
    <View
      style={[
        styles.item,
        chip ? [sizes.chip, { backgroundColor: chip.background }] : sizes.plain,
      ]}
    >
      <Ionicons name="calendar-outline" size={sizes.icon} color={color} />
      <Text style={[sizes.text, { color }]}>{dueLabel(todo)}</Text>
    </View>
  );
}

/** The todo's reminder time as plain gray text, or nothing if it has no reminder. */
export function ReminderChip({ todo, size = 'small' }: ChipProps) {
  const colors = useColors();
  if (!todo.reminderTime) return null;
  const color = todo.completed ? colors.textSubtle : colors.textMuted;
  const sizes = SIZES[size];

  return (
    <View style={[styles.item, sizes.plain]}>
      <Ionicons name="notifications-outline" size={sizes.icon} color={color} />
      <Text style={[sizes.text, { color }]}>{formatTime(todo.reminderTime)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// Pill-shaped chips: a radius bigger than half the height rounds the ends fully.
const SIZES = {
  small: {
    icon: 10,
    ...StyleSheet.create({
      chip: { gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
      plain: { gap: 4 },
      text: { fontSize: 11, fontWeight: '500' },
    }),
  },
  medium: {
    icon: 14,
    ...StyleSheet.create({
      chip: { gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
      plain: { gap: 6 },
      text: { fontSize: 14, fontWeight: '500' },
    }),
  },
} as const;
