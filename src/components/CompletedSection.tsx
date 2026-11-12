import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Collapsible, ExpandChevron, useExpandable } from '@/components/Collapsible';
import { TodoItem } from '@/components/TodoItem';
import { colors } from '@/constants/theme';
import type { Todo } from '@/store/todos';

/**
 * "Completed" header styled like the filter dropdown. Tapping it smoothly opens
 * or closes the day's finished todos underneath. Starts open.
 */
export function CompletedSection({ todos }: { todos: Todo[] }) {
  const { expanded, toggle, progress } = useExpandable(true);

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Completed, ${todos.length}`}
          accessibilityState={{ expanded }}
        >
          <Text style={styles.headerText}>Completed</Text>
          <Text style={styles.count}>{todos.length}</Text>
          <ExpandChevron progress={progress} size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <Collapsible progress={progress} expanded={expanded}>
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </Collapsible>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same insets as the filter dropdown's toolbar, so the two headers line up.
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  // Matches the filter dropdown's button.
  header: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerPressed: {
    backgroundColor: colors.border,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  count: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
});
