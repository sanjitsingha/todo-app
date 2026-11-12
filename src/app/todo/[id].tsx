import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetGrabber } from '@/components/SheetGrabber';
import { DueDateChip, PriorityChip } from '@/components/TodoChips';
import { colors } from '@/constants/theme';
import { useTodos, type Todo } from '@/store/todos';

/**
 * Bottom sheet with a todo's details, opened by tapping it in the list (presented as a form
 * sheet, see src/app/_layout.tsx). Shows the full name and description, the due date and
 * priority, and a button to mark it done (or not done), which also closes the sheet.
 */
export default function TodoDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { todos, toggleTodo } = useTodos();
  // While the sheet slides away after the button is pressed, it keeps showing the todo as it
  // was, instead of flipping to the new state on the way out.
  const [closingWith, setClosingWith] = useState<Todo | null>(null);
  const todo = closingWith ?? todos.find((item) => item.id === id);

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 24;

  if (!todo) {
    return (
      <View style={[styles.screen, styles.content]}>
        <SheetGrabber />
        <Text style={styles.missing}>This todo isn’t here anymore.</Text>
      </View>
    );
  }

  const description = todo.description?.trim();

  const toggle = () => {
    setClosingWith(todo);
    toggleTodo(todo.id);
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      // Lets the Android sheet expand first and then scroll, instead of fighting over the drag.
      nestedScrollEnabled
    >
      <SheetGrabber />

      <Text
        style={[styles.title, todo.completed && styles.titleCompleted]}
        accessibilityRole="header"
      >
        {todo.title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      <View style={styles.divider} />

      <DetailRow icon="calendar-outline" label="Due date">
        <DueDateChip todo={todo} size="medium" />
      </DetailRow>
      <DetailRow icon="flag-outline" label="Priority">
        <PriorityChip todo={todo} size="medium" />
      </DetailRow>

      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.button,
          todo.completed ? styles.buttonSecondary : styles.buttonPrimary,
          pressed && (todo.completed ? styles.buttonSecondaryPressed : styles.buttonPrimaryPressed),
        ]}
        accessibilityRole="button"
      >
        <Ionicons
          name={todo.completed ? 'arrow-undo-outline' : 'checkmark'}
          size={20}
          color={todo.completed ? colors.text : colors.onPrimary}
        />
        <Text style={[styles.buttonText, todo.completed && styles.buttonTextSecondary]}>
          {todo.completed ? 'Mark as not done' : 'Mark as done'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/** A label with an icon on the left and a value on the right, like the add sheet's rows. */
function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Ionicons name={icon} size={20} color={colors.ink} />
        <Text style={styles.rowLabelText}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the sheet, so it's white all the way down when dragged to full screen.
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // Same spacing as the add sheet.
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 20,
  },
  // Same as the name in the add sheet.
  title: {
    paddingTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  titleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  description: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    backgroundColor: colors.border,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabelText: {
    fontSize: 16,
    color: colors.text,
  },
  // Same size as the "Add todo" button.
  button: {
    marginTop: 16,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonSecondary: {
    backgroundColor: colors.inputBackground,
  },
  buttonSecondaryPressed: {
    backgroundColor: colors.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  buttonTextSecondary: {
    color: colors.text,
  },
  missing: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 16,
    color: colors.textMuted,
  },
});
