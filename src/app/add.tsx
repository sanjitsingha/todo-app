import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DueDateField } from '@/components/DueDateField';
import { colors } from '@/constants/theme';
import type { DateKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos } from '@/store/todos';

/**
 * Bottom sheet for adding a todo (presented as a form sheet, see src/app/_layout.tsx).
 * The sheet sizes itself to this content, so the root view must not use flex: 1.
 */
export default function AddTodoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addTodo } = useTodos();
  const { todayKey, selectedDate, selectDate } = useSelectedDate();
  const descriptionRef = useRef<TextInputInstance>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Start on the day picked in the date strip, or today if that day is already past.
  const [dueDate, setDueDate] = useState<DateKey>(() =>
    selectedDate < todayKey ? todayKey : selectedDate,
  );

  const canAdd = title.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    addTodo({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
    });
    // Show the todo's day, so the new todo is visible in the list right away.
    selectDate(dueDate);
    router.back();
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <Text style={styles.heading}>New todo</Text>

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.textMuted}
        maxLength={120}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => descriptionRef.current?.focus()}
        accessibilityLabel="Title"
      />

      <TextInput
        ref={descriptionRef}
        style={[styles.input, styles.description]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        textAlignVertical="top"
        accessibilityLabel="Description, optional"
      />

      <DueDateField value={dueDate} onChange={setDueDate} />

      <Pressable
        onPress={handleAdd}
        disabled={!canAdd}
        style={({ pressed }) => [
          styles.button,
          !canAdd && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
      >
        <Text style={styles.buttonText}>Add todo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    fontSize: 16,
    color: colors.text,
  },
  description: {
    minHeight: 96,
    maxHeight: 160,
  },
  button: {
    marginTop: 4,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
