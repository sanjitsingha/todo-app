import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { useEffect, useRef, useState } from 'react';
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
import { DurationField } from '@/components/DurationField';
import { PriorityField } from '@/components/PriorityField';
import { ReminderField } from '@/components/ReminderField';
import { SheetGrabber } from '@/components/SheetGrabber';
import { colors } from '@/constants/theme';
import { parseDurationParam } from '@/lib/addSheetParams';
import { isDateKey, isTimeKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos, type Priority } from '@/store/todos';

/**
 * Bottom sheet for adding a todo (presented as a form sheet, see src/app/_layout.tsx).
 * Opens at 60% height and can be dragged to full screen. The form stays at the top, so it's
 * all visible at the starting height (on Android the content is laid out at full height either
 * way).
 */
export default function AddTodoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addTodo } = useTodos();
  const { todayKey, selectedDate, selectDate } = useSelectedDate();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const titleRef = useRef<TextInputInstance>(null);
  const descriptionRef = useRef<TextInputInstance>(null);

  // Put the cursor in the name field (opening the keyboard) once the sheet has finished sliding
  // up: focusing mid-animation can leave the keyboard closed on Android. Only the first time, so
  // coming back from the due-date sheet doesn't pop the keyboard up again.
  // (Web has no opening animation or transitionEnd event, so it uses autoFocus instead.)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing) return;
      unsubscribe();
      titleRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  // Start on the day picked in the date strip, or today if that day is already past.
  const [initialDueDate] = useState(() => (selectedDate < todayKey ? todayKey : selectedDate));
  // Set by the due-date, reminder and duration sheets (src/app/due-date.tsx,
  // src/app/reminder.tsx, src/app/duration.tsx) when they close with a pick. See
  // src/lib/addSheetParams.ts.
  const {
    dueDate: pickedDueDate,
    dueTime: pickedDueTime,
    reminderTime: pickedReminderTime,
    duration: pickedDuration,
  } = useLocalSearchParams<{
    dueDate?: string;
    dueTime?: string;
    reminderTime?: string;
    duration?: string;
  }>();
  const dueDate = isDateKey(pickedDueDate) ? pickedDueDate : initialDueDate;
  const dueTime = isTimeKey(pickedDueTime) ? pickedDueTime : undefined;
  const reminderTime = isTimeKey(pickedReminderTime) ? pickedReminderTime : undefined;
  // In minutes.
  const duration = parseDurationParam(pickedDuration);

  const canAdd = title.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    addTodo({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      dueTime,
      reminderTime,
      duration,
      priority,
    });
    // Show the todo's day, so the new todo is visible in the list right away.
    selectDate(dueDate);
    router.back();
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <SheetGrabber />

      {/* Name and description sit close together, as one block. */}
      <View>
        {/* Multiline only so a long name wraps onto the next line: Enter still moves on to
            the description instead of adding a line break, and pasted line breaks become spaces. */}
        <TextInput
          ref={titleRef}
          autoFocus={Platform.OS === 'web'}
          style={[styles.input, styles.title]}
          value={title}
          onChangeText={(text) => setTitle(text.replace(/\s*\n\s*/g, ' '))}
          placeholder="Todo name"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
          multiline
          // Just the line cursor: hides the drop-shaped handle Android puts under it.
          selectionHandleColor="transparent"
          returnKeyType="next"
          submitBehavior="submit"
          // Web ignores submitBehavior; this is what makes Enter submit there.
          blurOnSubmit={Platform.OS === 'web'}
          onSubmitEditing={() => descriptionRef.current?.focus()}
          accessibilityLabel="Todo name"
        />

        <TextInput
          ref={descriptionRef}
          style={[styles.input, styles.description]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          selectionHandleColor="transparent"
          textAlignVertical="top"
          accessibilityLabel="Description, optional"
        />
      </View>

      <DueDateField
        value={dueDate}
        time={dueTime}
        reminderTime={reminderTime}
        duration={duration}
      />

      <PriorityField value={priority} onChange={setPriority} />

      <DurationField
        value={duration}
        dueDate={dueDate}
        dueTime={dueTime}
        reminderTime={reminderTime}
      />

      <ReminderField
        dueDate={dueDate}
        dueTime={dueTime}
        value={reminderTime}
        duration={duration}
      />

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
  // Fills the sheet, so it's white all the way down when dragged to full screen.
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 20,
    gap: 12,
  },
  // Plain field: no box or underline.
  input: {
    paddingHorizontal: 0,
    // Hides the browser's focus box on web (phones don't draw one).
    // A solid style is needed: the browser's default "auto" style ignores the width.
    outlineStyle: 'solid',
    outlineWidth: 0,
    color: colors.text,
  },
  // The todo name reads as the sheet's title. Grows a line at a time as the name wraps.
  title: {
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  // Right under the name. One line to start; grows as you type, then scrolls.
  description: {
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 160,
    fontSize: 16,
    lineHeight: 22,
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
