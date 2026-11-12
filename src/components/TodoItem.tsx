import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Collapsible, ExpandChevron, useExpandable } from '@/components/Collapsible';
import { DueDateChip, dueLabel, PriorityChip, priorityOf } from '@/components/TodoChips';
import { colors } from '@/constants/theme';
import { useTodos, type Todo } from '@/store/todos';

/**
 * One todo in the list: rounded-square checkbox, title, due date (and time), and priority chip.
 * Tapping the row opens the todo's details sheet (src/app/todo/[id].tsx). Todos with a
 * description get a chevron that smoothly expands the row to show it between the title and
 * the date.
 */
export function TodoItem({ todo }: { todo: Todo }) {
  const router = useRouter();
  const { toggleTodo } = useTodos();
  const description = todo.description?.trim();
  const { expanded, toggle: toggleExpanded, progress } = useExpandable();

  return (
    <View style={styles.row}>
      {/* The whole row opens the details. It sits underneath, so the checkbox and chevron on
          top keep their own taps, and the press feedback covers the full row. */}
      <Pressable
        onPress={() => router.push({ pathname: '/todo/[id]', params: { id: todo.id } })}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          // Android shows a ripple instead.
          pressed && Platform.OS !== 'android' && styles.rowPressed,
        ]}
        android_ripple={{ color: colors.ripple }}
        accessibilityRole="button"
        accessibilityLabel={`${todo.title}, ${dueLabel(todo)}, ${priorityOf(todo).label} priority${
          todo.completed ? ', done' : ''
        }`}
        accessibilityHint="Opens the todo's details"
      />

      <Pressable
        onPress={() => toggleTodo(todo.id)}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.completed }}
        accessibilityLabel={todo.title}
      >
        <View style={[styles.checkbox, todo.completed && styles.checkboxChecked]}>
          {todo.completed ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
        </View>
      </Pressable>

      {/* Taps go through to the row underneath. Screen readers get all of this from the row's
          label instead. */}
      <View style={styles.content} aria-hidden>
        <Text style={[styles.title, todo.completed && styles.titleCompleted]} numberOfLines={2}>
          {todo.title}
        </Text>

        {description ? (
          <Collapsible progress={progress} expanded={expanded} contentStyle={styles.descriptionContent}>
            <Text style={styles.description}>{description}</Text>
          </Collapsible>
        ) : null}

        {/* Due date, then the priority chip. Wraps to a second line if it runs out of room. */}
        <View style={styles.meta}>
          <DueDateChip todo={todo} />
          <PriorityChip todo={todo} />
        </View>
      </View>

      {description ? (
        <Pressable
          onPress={toggleExpanded}
          hitSlop={12}
          style={styles.chevron}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Hide description' : 'Show description'}
          accessibilityState={{ expanded }}
        >
          <ExpandChevron progress={progress} size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
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
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  // Rounded square. 20px plus 2px margin each side = 24px, the title's line height.
  checkbox: {
    width: 20,
    height: 20,
    margin: 2,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.iconInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  content: {
    flex: 1,
    pointerEvents: 'none',
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
  descriptionContent: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  // Same height as the title's first line, so the chevron sits level with it.
  chevron: {
    height: 24,
    justifyContent: 'center',
  },
});
