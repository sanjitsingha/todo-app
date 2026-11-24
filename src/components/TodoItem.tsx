import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DueDateChip, dueLabel, priorityOf } from '@/components/TodoChips';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useTodos, type Todo } from '@/store/todos';

/**
 * One todo in the list: rounded-square checkbox, title, and due date (and time) below it. Like
 * a block on the timeline, the card is tinted by priority, with the title in a deep shade of the
 * same color; done todos are gray. Tapping the row opens the todo's details sheet
 * (src/app/todo/[id].tsx), which also shows the description.
 */
export function TodoItem({ todo }: { todo: Todo }) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { toggleTodo } = useTodos();
  const priority = priorityOf(todo, colors);

  return (
    <View style={[styles.row, !todo.completed && { backgroundColor: priority.background }]}>
      {/* The whole row opens the details. It sits underneath, so the checkbox on top keeps its
          own tap, and the press feedback covers the full row. */}
      <Pressable
        onPress={() => router.push({ pathname: '/todo/[id]', params: { id: todo.id } })}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          // Android shows a ripple instead.
          pressed && Platform.OS !== 'android' && styles.rowPressed,
        ]}
        android_ripple={{ color: colors.ripple }}
        accessibilityRole="button"
        accessibilityLabel={`${todo.title}, ${dueLabel(todo)}, ${priority.label} priority${
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
          {todo.completed ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
      </Pressable>

      {/* Taps go through to the row underneath. Screen readers get all of this from the row's
          label instead. */}
      <View style={styles.content} aria-hidden>
        <Text
          style={[styles.title, todo.completed ? styles.titleCompleted : { color: priority.deep }]}
          numberOfLines={2}
        >
          {todo.title}
        </Text>

        {/* The card's color shows the priority, so just the due date here. */}
        <View style={styles.meta}>
          <DueDateChip todo={todo} />
        </View>
      </View>
    </View>
  );
}

// The same on every side, so the gap to the checkbox is equal from the top and the left.
const CARD_PADDING = 8;
const TITLE_LINE_HEIGHT = 24;
// A rounded square, not a circle.
const CHECKBOX_SIZE = 18;
const CHECKBOX_RADIUS = 5;
// Centers the checkbox on the title's first line.
const CHECKBOX_MARGIN = (TITLE_LINE_HEIGHT - CHECKBOX_SIZE) / 2;
// Tighter than the checkbox's curve carried out to the card's edge (5 + 8 + 3 = 16), for a
// squarer card. The same as the app's other rounded pieces, like the Completed section header.
const CARD_RADIUS = 10;

const useStyles = createThemedStyles((colors) => ({
  // Lined up with the 16px edges of the rest of the screen. Tinted by priority while open (see
  // TodoItem); done, the card color (a very light gray in the light look).
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Between the checkbox and the title.
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: CARD_PADDING,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.card,
    // Keeps the Android ripple inside the rounded corners.
    overflow: 'hidden',
  },
  // A see-through shade over the card, so it darkens whatever color the card is.
  rowPressed: {
    backgroundColor: colors.ripple,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    margin: CHECKBOX_MARGIN,
    borderRadius: CHECKBOX_RADIUS,
    borderWidth: 1.5,
    borderColor: colors.iconInactive,
    // White, so the empty box stands out on the tinted card. Checked, it turns the Dooist orange.
    backgroundColor: colors.surface,
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
    // The checkbox is centered on this line (see CHECKBOX_MARGIN).
    lineHeight: TITLE_LINE_HEIGHT,
    fontWeight: '600',
    color: colors.text,
  },
  titleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
}));
