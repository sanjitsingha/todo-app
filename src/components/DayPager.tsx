import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type FlatList as RNFlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { DAYS_AFTER, DAYS_BEFORE } from '@/constants/dayRange';
import { addDays, toDateKey, type DateKey } from '@/lib/dates';

/**
 * When a finger lifts and no snap follows (one almost always does, and reports its own end),
 * the pager is at rest where the finger left it. This is how long to wait to be sure.
 */
const SETTLE_DELAY_MS = 100;

/** Gesture handler's list (so only one list takes a touch), with scroll events on the UI thread. */
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<DateKey>);

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

type Props = {
  /** The real current date. The pages reach a year back and five years ahead of it. */
  today: Date;
  /** The day on screen. */
  selectedDate: DateKey;
  onSelectDate: (date: DateKey) => void;
  /** Draws one day's page. */
  renderDay: (date: DateKey) => ReactNode;
  /**
   * Set while a swipe is under way to the day the pager is at (day N of the range, with a
   * fraction partway between two days), for the date strip to follow; null otherwise.
   */
  swipePosition: SharedValue<number | null>;
};

/**
 * Days side by side, a screen wide each, like a calendar's day view: swipe left for the next
 * day, right for the day before. The page follows the finger and snaps to a day natively, and
 * the day on either side is already drawn, so the next one is right there as it slides in.
 * The date strip moves along with it the whole way (`swipePosition`), ticking as the next day
 * reaches its center. When the pager settles on a new day, that day is picked.
 *
 * A day picked from outside (the date strip, midnight, back to today) shows at once, without
 * scrolling through the days between.
 *
 * Up-and-down scrolling inside a page, and the timeline's pinch, work as usual: the pages are
 * gesture handler lists too, so only one of them takes a touch.
 */
export function DayPager({ today, selectedDate, onSelectDate, renderDay, swipePosition }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  // The pager's own width once laid out; the window's until then (they're normally the same).
  const [pageWidth, setPageWidth] = useState(windowWidth);
  const listRef = useAnimatedRef<RNFlatList<DateKey>>();

  // A fixed range around the day the screen opened, so day positions never shift.
  const [days] = useState(() =>
    Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) =>
      toDateKey(addDays(today, i - DAYS_BEFORE)),
    ),
  );
  const indexByKey = useMemo(() => new Map(days.map((day, i) => [day, i])), [days]);

  // Undefined if the selected date is outside the range; the pager then stays put.
  const selectedIndex = indexByKey.get(selectedDate);
  const [initialIndex] = useState(selectedIndex ?? DAYS_BEFORE);

  /** The page on screen, as far as the pager knows. */
  const shownIndex = useRef(initialIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // From the moment a finger starts dragging until the pager comes to rest, the strip follows.
  // Only then: a jump to a day picked from outside mustn't drag the strip along with it.
  const swiping = useSharedValue(false);
  const scrollHandler = useAnimatedScrollHandler(
    {
      onBeginDrag: () => {
        swiping.set(true);
      },
      onScroll: (event) => {
        if (swiping.get()) swipePosition.set(event.contentOffset.x / pageWidth);
      },
      onMomentumEnd: () => {
        swiping.set(false);
        swipePosition.set(null);
      },
    },
    [pageWidth],
  );

  // The pager came to rest at `x`: pick the day there.
  const settle = (x: number) => {
    clearTimeout(settleTimer.current);
    // In case it stopped without a snap (no momentum end).
    swiping.set(false);
    swipePosition.set(null);
    const index = Math.min(Math.max(Math.round(x / pageWidth), 0), days.length - 1);
    if (index === shownIndex.current) return;
    shownIndex.current = index;
    onSelectDate(days[index]);
  };

  // A day picked from outside: jump straight to it.
  useEffect(() => {
    if (selectedIndex === undefined || selectedIndex === shownIndex.current) return;
    shownIndex.current = selectedIndex;
    listRef.current?.scrollToIndex({ index: selectedIndex, animated: false });
  }, [selectedIndex, listRef]);

  // The page width changed: keep the same day on screen.
  const scrolledWidth = useRef(pageWidth);
  useEffect(() => {
    if (scrolledWidth.current === pageWidth) return;
    scrolledWidth.current = pageWidth;
    listRef.current?.scrollToOffset({ offset: shownIndex.current * pageWidth, animated: false });
  }, [pageWidth, listRef]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && Math.abs(width - pageWidth) >= 0.5) setPageWidth(width);
  };

  const renderItem = useCallback(
    ({ item }: { item: DateKey }) => <View style={{ width: pageWidth }}>{renderDay(item)}</View>,
    [pageWidth, renderDay],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: pageWidth, offset: pageWidth * index, index }),
    [pageWidth],
  );

  return (
    <AnimatedFlatList
      ref={listRef}
      data={days}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialIndex}
      // The day on screen first, then the one on each side, ready for a swipe. A swipe starts
      // drawing the next one along as soon as the page moves, well before it can come into view.
      // More would make switching views slower: each page is a whole list or timeline.
      initialNumToRender={1}
      windowSize={3}
      maxToRenderPerBatch={1}
      // Keeps pages drawn while they slide in; Android otherwise detaches off-screen ones.
      removeClippedSubviews={false}
      onLayout={onLayout}
      // The strip follows every frame of the swipe.
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => clearTimeout(settleTimer.current)}
      onScrollEndDrag={(event: ScrollEvent) => {
        const x = event.nativeEvent.contentOffset.x;
        settleTimer.current = setTimeout(() => settle(x), SETTLE_DELAY_MS);
      }}
      onMomentumScrollBegin={() => clearTimeout(settleTimer.current)}
      onMomentumScrollEnd={(event: ScrollEvent) => settle(event.nativeEvent.contentOffset.x)}
      style={styles.pager}
    />
  );
}

const keyExtractor = (day: DateKey) => day;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
