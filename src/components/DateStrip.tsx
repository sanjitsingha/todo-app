import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { addDays, shortWeekday, toDateKey, type DateKey } from '@/lib/dates';
import { tick } from '@/lib/feedback';

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
 * dark circle as it slides in, with a tick per day while swiping (src/lib/feedback.ts).
 * Tapping a day, or changing `selectedDate` from outside (a todo added for another day,
 * midnight), slides the strip to that day.
 */
export function DateStrip({ today, selectedDate, onSelectDate }: Props) {
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
  const [scrollX] = useState(() => new Animated.Value(initialIndex * DAY_WIDTH));
  // The index under the center, as last seen from scroll events.
  const centeredIndex = useRef(initialIndex);
  // Where the strip is sliding by itself (after a tap or an outside change), if it is.
  const slideTarget = useRef<number | null>(null);

  // Scroll position drives the animations on the native side, so they stay smooth.
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
    [scrollX],
  );

  // Swiping: each time a new day crosses the center, tick and select it.
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const index = Math.min(Math.max(Math.round(value / DAY_WIDTH), 0), days.length - 1);
      if (index === centeredIndex.current) return;
      centeredIndex.current = index;

      if (slideTarget.current !== null) {
        // Sliding by itself: the target day is already selected, so stay quiet on the way.
        if (index === slideTarget.current) slideTarget.current = null;
        return;
      }
      tick();
      onSelectDate(toDateKey(days[index]));
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, days, onSelectDate]);

  // The selected day changed without a swipe: slide to it.
  useEffect(() => {
    if (selectedIndex === undefined || selectedIndex === centeredIndex.current) return;
    slideTarget.current = selectedIndex;
    listRef.current?.scrollToOffset({ offset: selectedIndex * DAY_WIDTH, animated: true });
  }, [selectedIndex]);

  const handlePressDay = useCallback(
    (index: number) => {
      if (index === centeredIndex.current) return;
      tick();
      onSelectDate(toDateKey(days[index]));
    },
    [days, onSelectDate],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Date; index: number }) => (
      <DayItem
        date={item}
        index={index}
        scrollX={scrollX}
        isToday={toDateKey(item) === todayKey}
        onPress={handlePressDay}
      />
    ),
    [scrollX, todayKey, handlePressDay],
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
      // Side padding lets the first and last day reach the center.
      contentContainerStyle={{ paddingHorizontal: (width - DAY_WIDTH) / 2 }}
      getItemLayout={(_, index) => ({ length: DAY_WIDTH, offset: DAY_WIDTH * index, index })}
      initialScrollIndex={initialIndex}
      snapToInterval={DAY_WIDTH}
      decelerationRate="fast"
      onScroll={handleScroll}
      // A swipe takes over from a slide in progress.
      onScrollBeginDrag={() => {
        slideTarget.current = null;
      }}
      scrollEventThrottle={16}
      windowSize={7}
      initialNumToRender={15}
    />
  );
}

type DayItemProps = {
  date: Date;
  index: number;
  scrollX: Animated.Value;
  isToday: boolean;
  onPress: (index: number) => void;
};

const DayItem = memo(function DayItem({ date, index, scrollX, isToday, onPress }: DayItemProps) {
  // How close this day is to the center: 0 = one day away (or more), 1 = centered.
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * DAY_WIDTH, index * DAY_WIDTH, (index + 1) * DAY_WIDTH];
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
  }, [scrollX, index]);

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
      style={styles.day}
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
    width: DAY_WIDTH,
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
