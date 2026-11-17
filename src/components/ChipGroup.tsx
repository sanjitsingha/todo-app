import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
  /** What the choice is, for screen readers, e.g. "Time range". */
  accessibilityLabel: string;
};

/**
 * A row of pill buttons, one picked at a time, like the Stats tab's Today / Week / Month. The
 * picked one is the app's yellow; the rest are white, for a gray page.
 */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && (selected ? styles.chipSelectedPressed : styles.chipPressed),
            ]}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipPressed: {
    backgroundColor: colors.inputBackground,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipSelectedPressed: {
    backgroundColor: colors.primaryPressed,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  labelSelected: {
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
