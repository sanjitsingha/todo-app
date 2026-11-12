import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { DUE_DATE_COLORS } from '@/constants/dueDate';
import { PRIORITIES } from '@/constants/priority';
import { colors } from '@/constants/theme';
import { formatDueDateTime, getDueDateKind, isOverdue } from '@/lib/dates';
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

/** The todo's priority level, with its label and colors. */
export function priorityOf(todo: Todo) {
  return PRIORITIES.find((level) => level.value === todo.priority) ?? PRIORITIES[1];
}

/**
 * The todo's due date (and time). Today, Tomorrow, This weekend and Next week get a chip in the
 * same color as their choice in the due-date sheet. Other days, and finished todos, show the
 * date as plain gray text, and overdue ones in red.
 */
export function DueDateChip({ todo, size = 'small' }: ChipProps) {
  const overdue = !todo.completed && isOverdue(todo.dueDate);
  const kind = todo.completed ? null : getDueDateKind(todo.dueDate);
  const chip = kind ? DUE_DATE_COLORS[kind] : null;
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

/** The todo's priority as a tinted pill. Finished todos keep the pill, but in gray. */
export function PriorityChip({ todo, size = 'small' }: ChipProps) {
  const priority = priorityOf(todo);
  const color = todo.completed ? colors.textSubtle : priority.color;
  const background = todo.completed ? colors.inputBackground : priority.background;
  const sizes = SIZES[size];

  return (
    <View
      style={[styles.item, sizes.chip, { backgroundColor: background }]}
      accessible
      accessibilityLabel={`${priority.label} priority`}
    >
      <Ionicons name="flag-outline" size={sizes.icon} color={color} />
      <Text style={[sizes.text, { color }]}>{priority.label}</Text>
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
    icon: 12,
    ...StyleSheet.create({
      chip: { gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
      plain: { gap: 6 },
      text: { fontSize: 12, fontWeight: '500' },
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
