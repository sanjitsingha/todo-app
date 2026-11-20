import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
// Just this icon, not the whole icon set.
import Trash2 from 'lucide-react-native/icons/trash-2';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PriorityField } from '@/components/PriorityField';
import { SheetGrabber } from '@/components/SheetGrabber';
import { DueDateChip, dueLabel, ReminderChip } from '@/components/TodoChips';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { formatTime } from '@/lib/dates';
import { useTodos, type Todo } from '@/store/todos';

/**
 * Bottom sheet with a todo's details, opened by tapping it in the list (presented as a form
 * sheet, see src/app/_layout.tsx). Everything in it can be changed in place, with no separate
 * edit mode: tap the name or description to type, tap Due date or Reminder for their sheets
 * (which save to this todo and come back here), or tap a priority. The button at the bottom
 * marks it done (or not done) and closes the sheet. The trash beside the name deletes it, after
 * asking.
 */
export default function TodoDetailsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { todos, updateTodo, toggleTodo, deleteTodo } = useTodos();
  // While the sheet slides away after the button is pressed, it keeps showing the todo as it
  // was, instead of flipping to the new state on the way out.
  const [closingWith, setClosingWith] = useState<Todo | null>(null);
  const todo = closingWith ?? todos.find((item) => item.id === id);

  // A name can't be emptied: clearing it and leaving the field puts the old one back.
  const title = useDraft(todo?.title ?? '', (text) => {
    const next = text.replace(/\s*\n\s*/g, ' ').trim();
    if (todo && next && next !== todo.title) updateTodo(todo.id, { title: next });
  });
  const savedDescription = todo?.description?.trim() ?? '';
  const description = useDraft(savedDescription, (text) => {
    const next = text.trim();
    if (todo && next !== savedDescription) updateTodo(todo.id, { description: next || undefined });
  });

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 24;

  // Asks first. Deleted, the sheet closes still showing the todo, rather than "isn't here".
  const confirmDelete = () => {
    if (!todo) return;
    Keyboard.dismiss();
    Alert.alert('Delete this todo?', `“${todo.title}” will be deleted. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setClosingWith(todo);
          deleteTodo(todo.id);
          router.back();
        },
      },
    ]);
  };

  if (!todo) {
    return (
      <View style={[styles.screen, styles.content]}>
        <SheetGrabber />
        <Text style={styles.missing}>This todo isn’t here anymore.</Text>
      </View>
    );
  }

  const toggle = () => {
    setClosingWith(todo);
    toggleTodo(todo.id);
    router.back();
  };

  const openDueDate = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/due-date',
      params: {
        todoId: todo.id,
        value: todo.dueDate,
        ...(todo.dueTime ? { time: todo.dueTime } : {}),
      },
    });
  };

  const openReminder = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/reminder',
      params: {
        todoId: todo.id,
        dueDate: todo.dueDate,
        ...(todo.dueTime ? { dueTime: todo.dueTime } : {}),
        ...(todo.reminderTime ? { value: todo.reminderTime } : {}),
      },
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      // Lets the Android sheet expand first and then scroll, instead of fighting over the drag.
      nestedScrollEnabled
      // With the keyboard up, a tap on a row or button works right away, instead of only
      // closing the keyboard.
      keyboardShouldPersistTaps="handled"
    >
      <SheetGrabber />

      {/* The name, with the trash at its right. */}
      <View style={styles.titleRow}>
        {/* Looks like plain text until tapped. Multiline only so a long name wraps: Enter
            finishes editing, and pasted line breaks become spaces. */}
        <TextInput
          style={[
            styles.input,
            styles.title,
            styles.titleInput,
            todo.completed && styles.titleCompleted,
          ]}
          {...title}
          placeholder="Todo name"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
          multiline
          // Just the line cursor: hides the drop-shaped handle Android puts under it.
          selectionHandleColor="transparent"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          // Web ignores submitBehavior; this is what makes Enter finish there.
          blurOnSubmit={Platform.OS === 'web'}
          accessibilityLabel="Todo name"
          accessibilityHint="Edits the name"
        />
        <Pressable
          onPress={confirmDelete}
          hitSlop={10}
          style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
          accessibilityRole="button"
          accessibilityLabel="Delete todo"
        >
          <Trash2 size={DELETE_ICON_SIZE} color={colors.danger} />
        </Pressable>
      </View>
      <TextInput
        style={[styles.input, styles.description]}
        {...description}
        placeholder="Add description"
        placeholderTextColor={colors.iconInactive}
        maxLength={500}
        multiline
        selectionHandleColor="transparent"
        textAlignVertical="top"
        accessibilityLabel="Description"
        accessibilityHint="Edits the description"
      />

      <View style={styles.divider} />

      <DetailRow
        icon="calendar-outline"
        label="Due date"
        onPress={openDueDate}
        accessibilityLabel={`Due date, ${dueLabel(todo)}`}
        accessibilityHint="Opens date options, a calendar, and a time picker"
      >
        <DueDateChip todo={todo} size="medium" />
      </DetailRow>
      <PriorityField
        value={todo.priority}
        onChange={(priority) => updateTodo(todo.id, { priority })}
      />
      <DetailRow
        icon="notifications-outline"
        label="Reminder"
        onPress={openReminder}
        accessibilityLabel={
          todo.reminderTime ? `Reminder, ${formatTime(todo.reminderTime)}` : 'Reminder, none'
        }
        accessibilityHint="Opens a time picker for a reminder notification"
      >
        {todo.reminderTime ? (
          <ReminderChip todo={todo} size="medium" />
        ) : (
          <Text style={styles.rowEmpty}>Add time</Text>
        )}
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

/**
 * Props for a text field that edits `saved` in place. Typing changes only the field; the text
 * is saved once editing ends (the field loses focus, or the sheet closes mid-edit), so the
 * todos aren't stored and their reminders re-synced on every keystroke.
 */
function useDraft(saved: string, save: (text: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  // The same draft, readable when the sheet closes.
  const pending = useRef<string | null>(null);
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  // Closed while still editing (swiped down, or "Mark as done"): save what was typed.
  useEffect(
    () => () => {
      if (pending.current !== null) latestSave.current(pending.current);
    },
    [],
  );

  return {
    value: draft ?? saved,
    onChangeText: (text: string) => {
      pending.current = text;
      setDraft(text);
    },
    onBlur: () => {
      if (pending.current !== null) latestSave.current(pending.current);
      pending.current = null;
      setDraft(null);
    },
  };
}

/**
 * A label with an icon on the left and a value on the right, like the add sheet's rows.
 * Tapping it opens the sheet that changes the value; the chevron says so.
 */
function DetailRow({
  icon,
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.rowLabel}>
        <Ionicons name={icon} size={20} color={colors.ink} />
        <Text style={styles.rowLabelText}>{label}</Text>
      </View>
      <View style={styles.rowValue}>
        {children}
        <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
      </View>
    </Pressable>
  );
}

/** A size down from the other icons in the sheet, so it stays out of the way of the name. */
const DELETE_ICON_SIZE = 18;

const useStyles = createThemedStyles((colors) => ({
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
  // Plain field: no box or underline, so it reads as text until tapped.
  input: {
    paddingHorizontal: 0,
    // Hides the browser's focus box on web (phones don't draw one).
    // A solid style is needed: the browser's default "auto" style ignores the width.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  // Same as the name in the add sheet.
  title: {
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  titleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  // Takes the row, so a long name wraps before the trash.
  titleInput: {
    flex: 1,
  },
  // Lined up with the name's first line: its top padding (8), plus half its line height (14),
  // less half the icon.
  delete: {
    marginTop: 8 + 14 - DELETE_ICON_SIZE / 2,
    borderRadius: 8,
  },
  deletePressed: {
    opacity: 0.5,
  },
  description: {
    paddingTop: 4,
    paddingBottom: 4,
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
    // Keeps the Android ripple inside the row.
    overflow: 'hidden',
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
  rowValue: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Same as the add sheet's empty Reminder row.
  rowEmpty: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
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
}));
