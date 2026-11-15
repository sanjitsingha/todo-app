import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import { useSnapStrip } from '@/hooks/useSnapStrip';
import { addDays, shortWeekday, toDateKey, type DateKey } from '@/lib/dates';

// A week across the screen, so the picked day sits in the middle with three on each side.
const VISIBLE_DAYS = 7;
const DAYS_BEFORE = 365;
// Due dates can be set far ahead, so the strip reaches 5 years forward.
const DAYS_AFTER = 365 * 5;

type Props = {
  /** The real current date. Screen readers announce it as "today". */
  today: Date;
  /** The day in the center of the strip. */
  selectedDate: DateKey;
  onSelectDate: (date: DateKey) => void;
};

/**
 * Swipeable row of days, a week wide: the weekday ("Mon") over the date. The day in the center
 * is the selected one: as it slides in, its date gets a soft gray box and its weekday turns
 * dark and bold, with a tick per day while swiping (src/hooks/useSnapStrip.ts).
 * The day is selected once the strip comes to rest. Tapping a day, or changing `selectedDate`
 * from outside (a todo added for another day, midnight), slides the strip to that day.
 */
export const DateStrip = memo(function DateStrip({ today, selectedDate, onSelectDate }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Date>>(null);
  const todayKey = toDateKey(today);

  // A fixed range around the day the screen opened, so day positions never shift.
  const [days] = useState(() =>
    Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => addDays(today, i - DAYS_BEFORE)),
  );
  const indexByKey = useMemo(() => new Map(days.map((day, i) => [toDateKey(day), i])), [days]);

  // Undefined if the selected date is outside the strip's range; the strip then stays put.
  const selectedIndex = indexByKey.get(selectedDate);
  const [initialIndex] = useState(selectedIndex ?? DAYS_BEFORE);

  const { step, scrollX, scrollProps, pick } = useSnapStrip({
    count: days.length,
    stepWidth: width / VISIBLE_DAYS,
    initialIndex,
    value: selectedIndex,
    onChange: (index) => onSelectDate(toDateKey(days[index])),
    scrollTo: (offset, animated) => listRef.current?.scrollToOffset({ offset, animated }),
  });

  const renderItem = useCallback(
    ({ item, index }: { item: Date; index: number }) => (
      <DayItem
        date={item}
        index={index}
        step={step}
        scrollX={scrollX}
        isToday={toDateKey(item) === todayKey}
        onPress={pick}
      />
    ),
    [step, scrollX, todayKey, pick],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: step, offset: step * index, index }),
    [step],
  );

  // Side padding lets the first and last day reach the center.
  const contentContainerStyle = useMemo(
    () => ({ paddingHorizontal: (width - step) / 2 }),
    [width, step],
  );

  return (
    <Animated.FlatList
      ref={listRef}
      data={days}
      keyExtractor={toDateKey}
      renderItem={renderItem}
      extraData={todayKey}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={contentContainerStyle}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialIndex}
      {...scrollProps}
      windowSize={7}
      initialNumToRender={15}
    />
  );
});

type DayItemProps = {
  date: Date;
  index: number;
  /** Width of a day, in points. */
  step: number;
  scrollX: Animated.Value;
  isToday: boolean;
  onPress: (index: number) => void;
};

const DayItem = memo(function DayItem({
  date,
  index,
  step,
  scrollX,
  isToday,
  onPress,
}: DayItemProps) {
  // How close this day is to the center: 0 = one day away (or more), 1 = centered.
  // Text weight and color can't run on the native driver, so the plain and picked looks are
  // two copies of the text crossfading.
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * step, index * step, (index + 1) * step];
    const between = (from: number, to: number) =>
      scrollX.interpolate({ inputRange, outputRange: [from, to, from], extrapolate: 'clamp' });
    return {
      boxOpacity: between(0, 1),
      boxScale: between(0.8, 1),
      plainOpacity: between(1, 0),
      pickedOpacity: between(0, 1),
    };
  }, [scrollX, index, step]);

  const weekday = shortWeekday(date);
  const day = date.getDate();

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={[styles.day, { width: step }]}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${day}${isToday ? ', today' : ''}`}
    >
      <View style={styles.weekdayRow}>
        <Animated.Text style={[styles.weekday, { opacity: animated.plainOpacity }]}>
          {weekday}
        </Animated.Text>
        <Animated.Text
          style={[styles.weekday, styles.weekdayPicked, { opacity: animated.pickedOpacity }]}
        >
          {weekday}
        </Animated.Text>
      </View>

      <View style={styles.dateBox}>
        <Animated.View
          style={[
            styles.box,
            { opacity: animated.boxOpacity, transform: [{ scale: animated.boxScale }] },
          ]}
        />
        <Animated.Text style={[styles.number, { opacity: animated.plainOpacity }]}>
          {day}
        </Animated.Text>
        <Animated.Text
          style={[styles.number, styles.numberPicked, { opacity: animated.pickedOpacity }]}
        >
          {day}
        </Animated.Text>
      </View>
    </Pressable>
  );
});

// Hugs the date, with just a little room around it.
const BOX_SIZE = 28;

const styles = StyleSheet.create({
  list: {
    // Horizontal lists stretch to fill the column by default; keep it to its content height.
    flexGrow: 0,
    marginBottom: 16,
  },
  day: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  // Holds both copies of the weekday on top of each other.
  weekdayRow: {
    alignSelf: 'stretch',
    height: 16,
  },
  weekday: {
    ...StyleSheet.absoluteFill,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 16,
    color: colors.textSubtle,
  },
  weekdayPicked: {
    fontWeight: '700',
    color: colors.text,
  },
  dateBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
  },
  // Soft gray, rounded square behind the picked date.
  box: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    backgroundColor: colors.inkSoft,
  },
  number: {
    ...StyleSheet.absoluteFill,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: BOX_SIZE,
    fontSize: 15,
    // The default digits are all one width, so a narrow "1" has empty space on its left and
    // dates like 15 sit off to the right of the box. Proportional digits center properly.
    fontVariant: ['proportional-nums'],
    // Android adds space above and below the text by default, which throws off centering
    // in a fixed-height box.
    includeFontPadding: false,
    color: colors.textMuted,
  },
  numberPicked: {
    fontWeight: '600',
    color: colors.text,
  },
});
