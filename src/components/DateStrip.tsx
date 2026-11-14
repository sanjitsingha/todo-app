import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import { useSnapStrip } from '@/hooks/useSnapStrip';
import { addDays, shortWeekday, toDateKey, type DateKey } from '@/lib/dates';

const DAY_WIDTH = 52;
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
 * Swipeable row of days. The day in the center is the selected one: it grows and gets a
 * dark circle as it slides in, with a tick per day while swiping (src/hooks/useSnapStrip.ts).
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
    stepWidth: DAY_WIDTH,
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
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * step, index * step, (index + 1) * step];
    const between = (from: number, to: number) =>
      scrollX.interpolate({ inputRange, outputRange: [from, to, from], extrapolate: 'clamp' });
    return {
      circleOpacity: between(0, 1),
      circleScale: between(0.8, 1),
      labelScale: between(0.85, 1.15),
      // The label fades from dark to white as the circle fills in behind it. (Text color
      // can't run on the native driver, so it's two copies crossfading.)
      darkLabelOpacity: between(0.3, 0),
      lightLabelOpacity: between(0, 1),
    };
  }, [scrollX, index, step]);

  const weekday = shortWeekday(date);

  const label = (onCircle: boolean) => (
    <Animated.View
      style={[
        styles.label,
        {
          opacity: onCircle ? animated.lightLabelOpacity : animated.darkLabelOpacity,
          transform: [{ scale: animated.labelScale }],
        },
      ]}
    >
      <Text style={[styles.number, onCircle && styles.textOnCircle]}>{date.getDate()}</Text>
      <Text style={[styles.weekday, onCircle && styles.textOnCircle]}>
        {weekday.toUpperCase()}
      </Text>
    </Animated.View>
  );

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={[styles.day, { width: step }]}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${date.getDate()}${isToday ? ', today' : ''}`}
    >
      <View style={styles.body}>
        <Animated.View
          style={[
            styles.circle,
            { opacity: animated.circleOpacity, transform: [{ scale: animated.circleScale }] },
          ]}
        />
        {label(false)}
        {label(true)}
      </View>
    </Pressable>
  );
});

// Fits the number and weekday at their centered size, with a little room to spare.
const CIRCLE_SIZE = 50;

const styles = StyleSheet.create({
  list: {
    // Horizontal lists stretch to fill the column by default; keep it to its content height.
    flexGrow: 0,
    marginBottom: 16,
  },
  day: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  body: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  circle: {
    ...StyleSheet.absoluteFill,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: colors.ink,
  },
  label: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  weekday: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.text,
  },
  textOnCircle: {
    color: colors.onInk,
  },
});
