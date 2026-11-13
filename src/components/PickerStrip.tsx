import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

import { colors } from '@/constants/theme';
import { tick } from '@/lib/feedback';

const ITEM_WIDTH = 52;

type Props = {
  /** What each step shows, e.g. "1" to "12". */
  items: readonly string[];
  /** Index of the step in the center. */
  value: number;
  onChange: (index: number) => void;
  /** Read out by screen readers, e.g. "Hour". */
  accessibilityLabel: string;
};

/**
 * A swipeable row of values that works like the date strip: the one in the center is picked,
 * it grows and gets a box, and each step gives a tick. Tapping a value slides it in.
 * Horizontal on purpose: a vertical wheel would fight the sheet's own up / down drag.
 */
export function PickerStrip({ items, value, onChange, accessibilityLabel }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(value * ITEM_WIDTH));
  // The index under the center, as last seen from scroll events.
  const centeredIndex = useRef(value);
  // Where the strip is sliding by itself (after a tap or an outside change), if it is.
  const slideTarget = useRef<number | null>(null);

  // Scroll callbacks read this, so they always reach the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
    [scrollX],
  );

  // Swiping: each time a new value crosses the center, tick and pick it.
  useEffect(() => {
    const id = scrollX.addListener(({ value: offset }) => {
      const index = Math.min(Math.max(Math.round(offset / ITEM_WIDTH), 0), items.length - 1);
      if (index === centeredIndex.current) return;
      centeredIndex.current = index;

      if (slideTarget.current !== null) {
        // Sliding by itself: the target is already picked, so stay quiet on the way.
        if (index === slideTarget.current) slideTarget.current = null;
        return;
      }
      tick();
      onChangeRef.current(index);
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, items.length]);

  // Once the width (and so the side padding) is known, put the picked value in the center.
  // (contentOffset below does this too, but not on every platform.)
  useEffect(() => {
    if (width === 0) return;
    scrollRef.current?.scrollTo({ x: centeredIndex.current * ITEM_WIDTH, animated: false });
  }, [width]);

  // The value changed without a swipe: slide to it.
  useEffect(() => {
    if (value === centeredIndex.current) return;
    slideTarget.current = value;
    scrollRef.current?.scrollTo({ x: value * ITEM_WIDTH, animated: true });
  }, [value]);

  const pick = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length || index === centeredIndex.current) return;
      tick();
      onChangeRef.current(index);
    },
    [items.length],
  );

  return (
    <View
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[value] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        pick(value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
      }
    >
      {width > 0 ? (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: value * ITEM_WIDTH, y: 0 }}
          // Side padding lets the first and last value reach the center.
          contentContainerStyle={{ paddingHorizontal: (width - ITEM_WIDTH) / 2 }}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          onScroll={handleScroll}
          // A swipe takes over from a slide in progress.
          onScrollBeginDrag={() => {
            slideTarget.current = null;
          }}
          scrollEventThrottle={16}
          // The strip as a whole is the screen-reader control (see above).
          importantForAccessibility="no-hide-descendants"
        >
          {items.map((label, index) => (
            <StripItem key={label} label={label} index={index} scrollX={scrollX} onPress={pick} />
          ))}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}

type StripItemProps = {
  label: string;
  index: number;
  scrollX: Animated.Value;
  onPress: (index: number) => void;
};

const StripItem = memo(function StripItem({ label, index, scrollX, onPress }: StripItemProps) {
  // How close this value is to the center: 0 = one step away (or more), 1 = centered.
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * ITEM_WIDTH, index * ITEM_WIDTH, (index + 1) * ITEM_WIDTH];
    const between = (from: number, to: number) =>
      scrollX.interpolate({ inputRange, outputRange: [from, to, from], extrapolate: 'clamp' });
    return {
      boxOpacity: between(0, 1),
      boxScale: between(0.8, 1),
      labelScale: between(0.85, 1.2),
      labelOpacity: between(0.3, 1),
    };
  }, [scrollX, index]);

  return (
    <Pressable onPress={() => onPress(index)} style={styles.item}>
      <Animated.View
        style={[
          styles.box,
          { opacity: animated.boxOpacity, transform: [{ scale: animated.boxScale }] },
        ]}
      />
      <Animated.Text
        style={[
          styles.label,
          { opacity: animated.labelOpacity, transform: [{ scale: animated.labelScale }] },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Fixed height, so nothing jumps while the width is being measured.
  container: {
    height: 52,
  },
  item: {
    width: ITEM_WIDTH,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same box as the selected day in the date strip.
  box: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 3,
    right: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
});
