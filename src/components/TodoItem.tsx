import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatDueDate, isOverdue } from '@/lib/dates';
import { useTodos, type Todo } from '@/store/todos';

/** One todo in the list: round checkbox, title, and due date. */
export function TodoItem({ todo }: { todo: Todo }) {
  const { toggleTodo } = useTodos();
  const overdue = !todo.completed && isOverdue(todo.dueDate);
  const dueColor = overdue ? colors.danger : colors.textMuted;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => toggleTodo(todo.id)}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.completed }}
        accessibilityLabel={todo.title}
      >
        <Ionicons
          name={todo.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={todo.completed ? colors.primary : colors.iconInactive}
        />
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.title, todo.completed && styles.titleCompleted]} numberOfLines={2}>
          {todo.title}
        </Text>

        <View style={styles.due}>
          <Ionicons name="calendar-outline" size={14} color={dueColor} />
          <Text style={[styles.dueText, { color: dueColor }]}>
            {overdue ? `Overdue · ${formatDueDate(todo.dueDate)}` : formatDueDate(todo.dueDate)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Plain row: no box, border, or divider. Spacing alone separates todos.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    // Matches the checkbox height, so the checkbox lines up with the first line of the title.
    lineHeight: 24,
    fontWeight: '600',
    color: colors.text,
  },
  titleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
