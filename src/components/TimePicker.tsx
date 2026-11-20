import { Pressable, Text, View } from 'react-native';

import { PickerStrip } from '@/components/PickerStrip';
import { createThemedStyles } from '@/hooks/useTheme';
import { fromDayMinutes, MINUTES_PER_DAY, parseTimeKey, type TimeKey } from '@/lib/dates';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['am', 'pm'] as const;

type Props = {
  value: TimeKey;
  onChange: (time: TimeKey) => void;
  /**
   * The earliest time that can be picked, in minutes since midnight (e.g. a reminder today
   * can't be in the past). Earlier hours, minutes and am / pm are faded and can't be picked.
   * MINUTES_PER_DAY means nothing can be. Leave it out to allow any time.
   */
  earliest?: number;
};

/** Minutes since midnight for an hour on the 12-hour clock (1 to 12), minutes and am / pm. */
function dayMinutes(hour12: number, minutes: number, isPm: boolean): number {
  return ((hour12 % 12) + (isPm ? 12 : 0)) * 60 + minutes;
}

/** Swipeable hour (1 to 12) and minute (00 to 59) strips, and an am / pm switch. */
export function TimePicker({ value, onChange, earliest = 0 }: Props) {
  const styles = useStyles();
  const { hours, minutes } = parseTimeKey(value);
  const isPm = hours >= 12;
  const hour12 = hours % 12 || 12;

  // Off limits when even its last minute is before `earliest`.
  const isHourDisabled = (index: number) => dayMinutes(index + 1, 59, isPm) < earliest;
  const isMinuteDisabled = (index: number) => dayMinutes(hour12, index, isPm) < earliest;
  const isPeriodDisabled = (pm: boolean) => dayMinutes(11, 59, pm) < earliest;

  // A new hour or am / pm can land before `earliest` (say 9 with :05 when it's 9:07): that
  // moves up to the earliest time instead.
  const update = (nextHour12: number, nextMinutes: number, nextIsPm: boolean) => {
    const next = Math.max(dayMinutes(nextHour12, nextMinutes, nextIsPm), earliest);
    if (next < MINUTES_PER_DAY) onChange(fromDayMinutes(next));
  };

  return (
    <View>
      <Text style={styles.caption}>HOUR</Text>
      <PickerStrip
        items={HOURS}
        value={hour12 - 1}
        onChange={(index) => update(index + 1, minutes, isPm)}
        accessibilityLabel="Hour"
        isDisabled={earliest > 0 ? isHourDisabled : undefined}
      />

      <Text style={styles.caption}>MINUTE</Text>
      <PickerStrip
        items={MINUTES}
        value={minutes}
        onChange={(index) => update(hour12, index, isPm)}
        accessibilityLabel="Minute"
        isDisabled={earliest > 0 ? isMinuteDisabled : undefined}
      />

      <View style={styles.periods} accessibilityRole="radiogroup" accessibilityLabel="am or pm">
        {PERIODS.map((period) => {
          const pm = period === 'pm';
          const selected = pm === isPm;
          const disabled = isPeriodDisabled(pm);
          return (
            <Pressable
              key={period}
              onPress={() => update(hour12, minutes, pm)}
              disabled={disabled}
              style={[
                styles.period,
                selected && styles.periodSelected,
                disabled && styles.periodDisabled,
              ]}
              accessibilityRole="radio"
              accessibilityLabel={period.toUpperCase()}
              accessibilityState={{ checked: selected, disabled }}
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

const useStyles = createThemedStyles((colors) => ({
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
  // Same fade as a passed hour or minute in the strips.
  periodDisabled: {
    opacity: 0.35,
  },
  periodText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodTextSelected: {
    color: colors.onPrimary,
  },
}));
