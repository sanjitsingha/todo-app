import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DAY_BOX_RADIUS, DAY_BOX_SIZE } from '@/components/DateStrip';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import {
  WEEKDAYS,
  addMonths,
  formatLongDate,
  formatMonthYear,
  getMonthGrid,
  startOfMonth,
  type DateKey,
} from '@/lib/dates';

type Props = {
  /** The picked day. The calendar opens on its month. */
  value: DateKey;
  /** Gets the orange dot, like in the date strip. */
  today: DateKey;
  /** Days before this are greyed out and can't be picked. */
  minDate?: DateKey;
  onSelect: (date: DateKey) => void;
};

/** A month of days with previous / next month buttons. Tapping a day picks it. */
export function Calendar({ value, today, minDate, onSelect }: Props) {
  const styles = useStyles();
  // The 1st of the month on screen.
  const [month, setMonth] = useState(() => startOfMonth(value));
  const canGoBack = !minDate || month > startOfMonth(minDate);
  const weeks = getMonthGrid(month);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.monthLabel} accessibilityRole="header">
          {formatMonthYear(month)}
        </Text>
        <View style={styles.nav}>
          <NavButton
            icon="chevron-back"
            label="Previous month"
            disabled={!canGoBack}
            onPress={() => setMonth(addMonths(month, -1))}
          />
          <NavButton
            icon="chevron-forward"
            label="Next month"
            onPress={() => setMonth(addMonths(month, 1))}
          />
        </View>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((name) => (
          <Text key={name} style={styles.weekday}>
            {name.toUpperCase()}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((day, dayIndex) =>
            day ? (
              <DayCell
                key={day}
                day={day}
                selected={day === value}
                isToday={day === today}
                disabled={minDate !== undefined && day < minDate}
                onPress={() => onSelect(day)}
              />
            ) : (
              <View key={`empty-${dayIndex}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function NavButton({
  icon,
  label,
  disabled = false,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.navButton,
        pressed && styles.pressed,
        disabled && styles.navButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function DayCell({
  day,
  selected,
  isToday,
  disabled,
  onPress,
}: {
  day: DateKey;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDate(day)}${isToday ? ', today' : ''}`}
      accessibilityState={{ selected, disabled }}
    >
      {({ pressed }) => (
        <View style={[styles.day, pressed && styles.pressed, selected && styles.daySelected]}>
          <Text
            style={[
              styles.dayText,
              isToday && styles.dayTextToday,
              selected && styles.dayTextSelected,
              disabled && styles.dayTextDisabled,
            ]}
          >
            {Number(day.slice(8))}
          </Text>
          {isToday ? <View style={styles.todayDot} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const DAY_SIZE = 38;
/** The date strip's box corners, scaled to this size, so the picked day is the same shape. */
const DAY_RADIUS = Math.round(DAY_SIZE * (DAY_BOX_RADIUS / DAY_BOX_SIZE));

const useStyles = createThemedStyles((colors) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  nav: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  pressed: {
    backgroundColor: colors.inputBackground,
  },
  week: {
    flexDirection: 'row',
  },
  // Same look as the weekday labels in the date strip.
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  cell: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A rounded square, like the picked day in the date strip (the press shade takes it too).
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The date strip's soft gray.
  daySelected: {
    backgroundColor: colors.inkSoft,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  dayTextToday: {
    fontWeight: '700',
  },
  dayTextSelected: {
    fontWeight: '700',
    color: colors.text,
  },
  dayTextDisabled: {
    color: colors.textSubtle,
    opacity: 0.5,
  },
  // Stays orange when today is picked too: it shows up well on the gray.
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
}));
