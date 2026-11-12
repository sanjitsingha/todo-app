import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import { addDays, shortWeekday, toDateKey, type DateKey } from '@/lib/dates';

const DAY_WIDTH = 52;
const DAYS_BEFORE = 365;
// Due dates can be set far ahead, so the strip reaches 5 years forward.
const DAYS_AFTER = 365 * 5;

/** A light "tick" each time a new day snaps into the center, like the iOS picker wheel. */
function tick() {
  if (Platform.OS === 'android') {
    // Segment_Tick is meant for stepping through a list, but only exists on Android 14+.
    const type =
      Platform.Version >= 34 ? Haptics.AndroidHaptics.Segment_Tick : Haptics.AndroidHaptics.Clock_Tick;
    Haptics.performAndroidHapticsAsync(type).catch(() => {});
  } else {
    Haptics.selectionAsync().catch(() => {});
  }
}

type Props = {
  /** The real current date. Gets the orange dot. */
  today: Date;
  /** The day in the center of the strip. */
  selectedDate: DateKey;
  onSelectDate: (date: DateKey) => void;
};

/**
 * Swipeable row of days. The day in the center is the selected one: it grows and gets a
 * bordered box as it slides in, with a haptic tick per day while swiping.
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
      boxOpacity: between(0, 1),
      boxScale: between(0.8, 1),
      contentScale: between(1, 1.2),
      contentOpacity: between(0.4, 1),
    };
  }, [scrollX, index]);

  const weekday = shortWeekday(date);

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={styles.day}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${date.getDate()}${isToday ? ', today' : ''}`}
    >
      <Animated.View
        style={[
          styles.box,
          { opacity: animated.boxOpacity, transform: [{ scale: animated.boxScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.content,
          { opacity: animated.contentOpacity, transform: [{ scale: animated.contentScale }] },
        ]}
      >
        <View style={[styles.dot, isToday && styles.dotVisible]} />
        <Text style={styles.number}>{date.getDate()}</Text>
        <Text style={styles.weekday}>{weekday.toUpperCase()}</Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: {
    // Horizontal lists stretch to fill the column by default; keep it to its content height.
    flexGrow: 0,
    marginBottom: 16,
  },
  day: {
    width: DAY_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 3,
    right: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 4,
  },
  dotVisible: {
    backgroundColor: colors.accent,
  },
  number: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  weekday: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.text,
  },
});
