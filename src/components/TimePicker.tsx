import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PickerStrip } from '@/components/PickerStrip';
import { colors } from '@/constants/theme';
import { parseTimeKey, toTimeKey, type TimeKey } from '@/lib/dates';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['am', 'pm'] as const;

type Props = {
  value: TimeKey;
  onChange: (time: TimeKey) => void;
};

/** Swipeable hour (1 to 12) and minute (00 to 59) strips, and an am / pm switch. */
export function TimePicker({ value, onChange }: Props) {
  const { hours, minutes } = parseTimeKey(value);
  const isPm = hours >= 12;
  const hour12 = hours % 12 || 12;

  const update = (nextHour12: number, nextMinutes: number, nextIsPm: boolean) => {
    onChange(toTimeKey((nextHour12 % 12) + (nextIsPm ? 12 : 0), nextMinutes));
  };

  return (
    <View>
      <Text style={styles.caption}>HOUR</Text>
      <PickerStrip
        items={HOURS}
        value={hour12 - 1}
        onChange={(index) => update(index + 1, minutes, isPm)}
        accessibilityLabel="Hour"
      />

      <Text style={styles.caption}>MINUTE</Text>
      <PickerStrip
        items={MINUTES}
        value={minutes}
        onChange={(index) => update(hour12, index, isPm)}
        accessibilityLabel="Minute"
      />

      <View style={styles.periods} accessibilityRole="radiogroup" accessibilityLabel="am or pm">
        {PERIODS.map((period) => {
          const selected = (period === 'pm') === isPm;
          return (
            <Pressable
              key={period}
              onPress={() => update(hour12, minutes, period === 'pm')}
              style={[styles.period, selected && styles.periodSelected]}
              accessibilityRole="radio"
              accessibilityLabel={period.toUpperCase()}
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.periodText, selected && styles.periodTextSelected]}>
                {period}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same look as the calendar's weekday labels.
  caption: {
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  periods: {
    alignSelf: 'center',
    flexDirection: 'row',
    marginTop: 14,
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
  },
  period: {
    minWidth: 76,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSelected: {
    backgroundColor: colors.primary,
  },
  periodText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodTextSelected: {
    color: colors.onPrimary,
  },
});
