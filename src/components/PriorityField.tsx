import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { priorityLevels } from '@/constants/priority';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { Priority } from '@/store/todos';

type Props = {
  value: Priority;
  onChange: (value: Priority) => void;
};

/**
 * Priority row in the add-todo sheet and a todo's details: a flag and label on the left, and
 * the three levels as pills on the right. One tap picks a level; the picked one gets its color.
 */
export function PriorityField({ value, onChange }: Props) {
  const styles = useStyles();
  const priorities = priorityLevels(useColors());
  const selected = priorities.find((priority) => priority.value === value) ?? priorities[1];

  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <Ionicons name="flag-outline" size={20} color={selected.color} />
        <Text style={styles.labelText}>Priority</Text>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Priority">
        {priorities.map((priority) => {
          const isSelected = priority.value === value;
          return (
            <Pressable
              key={priority.value}
              onPress={() => onChange(priority.value)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
                isSelected && { backgroundColor: priority.background },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={priority.label}
              accessibilityState={{ checked: isSelected }}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && { color: priority.color, fontWeight: '600' },
                ]}
              >
                {priority.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Same height and label style as the Due date row above it.
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelText: {
    fontSize: 16,
    color: colors.text,
  },
  options: {
    flexDirection: 'row',
    gap: 4,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  optionPressed: {
    backgroundColor: colors.inputBackground,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
}));
