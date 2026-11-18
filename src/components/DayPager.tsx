import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DAYS_AFTER, DAYS_BEFORE } from '@/constants/dayRange';
import { addDays, toDateKey, type DateKey } from '@/lib/dates';

/**
 * A swipe only changes the day once the finger has gone this far sideways, in points...
 */
const SWIPE_START_DISTANCE = 16;
/**
 * ...and only if it hasn't first gone this far up or down: then it's a scroll of the day's
 * list or timeline, and the day stays put for the rest of that touch. So a swipe has to be
 * within about 30° of level to change the day, and an up-and-down scroll can wander well off
 * straight without the day changing.
 */
const SCROLL_FIRST_DISTANCE = 10;
/** Let go moving at least this fast (points per second), a swipe goes to the next day. */
const FLICK_VELOCITY = 400;
/** Sliding onto a day once let go, carrying the swipe's speed, without overshooting it. */
const SNAP_SPRING = { duration: 380, dampingRatio: 1, overshootClamping: true };

/** The pages: a plain list, scrolled by the swipe gesture below rather than by itself. */
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<DateKey>);

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

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
 * day, right for the day before, one day per swipe. The page follows the finger and slides onto
 * a day when let go, and the day on either side is already drawn, so the next one is right
 * there as it slides in. The date strip moves along with it the whole way (`swipePosition`),
 * ticking as the next day reaches its center. When the pager settles on a new day, that day is
 * picked.
 *
 * Up and down wins: a touch only becomes a swipe if it heads sideways first (see
 * SWIPE_START_DISTANCE), so scrolling a day's list or timeline doesn't slip into the next day
 * when the finger drifts off straight. That's why the pager isn't a natively scrolling list:
 * those take any touch that moves a few points sideways. The swipe is one finger, so the
 * timeline's pinch works as usual. It all runs on the UI thread.
 *
 * A day picked from outside (the date strip, midnight, back to today) shows at once, without
 * scrolling through the days between.
 */
export function DayPager({ today, selectedDate, onSelectDate, renderDay, swipePosition }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  // The pager's own width once laid out; the window's until then (they're normally the same).
  const [pageWidth, setPageWidth] = useState(windowWidth);
  const listRef = useAnimatedRef<FlatList<DateKey>>();

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
  const lastIndex = days.length - 1;

  // How far the pages are scrolled, in points. Everything that moves them sets this, and the
  // list follows it on the UI thread.
  const offset = useSharedValue(initialIndex * pageWidth);
  const swipeStart = useSharedValue(0);
  // From the moment a swipe starts until the pager comes to rest, the strip follows. Only then:
  // a jump to a day picked from outside mustn't drag the strip along with it.
  const swiping = useSharedValue(false);

  useAnimatedReaction(
    () => offset.get(),
    (x, previous) => {
      // The list opens on its first day by itself (initialScrollIndex).
      if (previous === null || x === previous) return;
      scrollTo(listRef, x, 0, false);
      if (swiping.get()) swipePosition.set(x / pageWidth);
    },
  );

  // The pager came to rest on day `index`: pick it.
  const settle = (index: number) => {
    if (index === shownIndex.current) return;
    shownIndex.current = index;
    onSelectDate(days[index]);
  };

  const swipe = usePanGesture({
    maxPointers: 1,
    activeOffsetX: [-SWIPE_START_DISTANCE, SWIPE_START_DISTANCE],
    failOffsetY: [-SCROLL_FIRST_DISTANCE, SCROLL_FIRST_DISTANCE],
    onActivate: () => {
      'worklet';
      // A swipe while the last one is still sliding picks up from where it's got to.
      cancelAnimation(offset);
      swipeStart.set(offset.get());
      swiping.set(true);
    },
    onUpdate: (event) => {
      'worklet';
      offset.set(clamp(swipeStart.get() - event.translationX, 0, lastIndex * pageWidth));
    },
    onDeactivate: (event) => {
      'worklet';
      // Where it's let go, in days. A flick goes on to the next day in its direction; otherwise
      // it goes to whichever day is nearer. Never more than a day from where the swipe began.
      const position = offset.get() / pageWidth;
      const from = Math.round(swipeStart.get() / pageWidth);
      let target = Math.round(position);
      if (event.velocityX <= -FLICK_VELOCITY) target = Math.floor(position) + 1;
      else if (event.velocityX >= FLICK_VELOCITY) target = Math.ceil(position) - 1;
      target = clamp(clamp(target, from - 1, from + 1), 0, lastIndex);

      offset.set(
        withSpring(
          target * pageWidth,
          { ...SNAP_SPRING, velocity: -event.velocityX },
          (finished) => {
            // Cut short by the next swipe, which settles instead.
            if (!finished) return;
            swiping.set(false);
            swipePosition.set(null);
            scheduleOnRN(settle, target);
          },
        ),
      );
    },
  });

  // A day picked from outside: jump straight to it.
  useEffect(() => {
    if (selectedIndex === undefined || selectedIndex === shownIndex.current) return;
    shownIndex.current = selectedIndex;
    cancelAnimation(offset);
    swiping.set(false);
    offset.set(selectedIndex * pageWidth);
    // Only on a new pick; a new page width is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // The page width changed: keep the same day on screen.
  const scrolledWidth = useRef(pageWidth);
  useEffect(() => {
    if (scrolledWidth.current === pageWidth) return;
    scrolledWidth.current = pageWidth;
    offset.set(shownIndex.current * pageWidth);
  }, [pageWidth, offset]);

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
    <GestureDetector gesture={swipe}>
      <AnimatedFlatList
        ref={listRef}
        data={days}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        // Scrolled only by the swipe above, never by the list's own dragging.
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        // The day on screen first, then the one on each side, ready for a swipe. A swipe starts
        // drawing the next one along as soon as the page moves, well before it can come into
        // view. More would make switching views slower: each page is a whole list or timeline.
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={1}
        // Keeps pages drawn while they slide in; Android otherwise detaches off-screen ones.
        removeClippedSubviews={false}
        onLayout={onLayout}
        // Tells the list where it's scrolled to as it moves, so it draws the next day in time.
        scrollEventThrottle={16}
        style={styles.pager}
      />
    </GestureDetector>
  );
}

const keyExtractor = (day: DateKey) => day;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
