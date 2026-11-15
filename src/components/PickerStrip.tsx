import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

import { colors } from '@/constants/theme';
import { useSnapStrip } from '@/hooks/useSnapStrip';

const ITEM_WIDTH = 52;

type Props = {
  /** What each step shows, e.g. "1" to "12". */
  items: readonly string[];
  /** Index of the step in the center. */
  value: number;
  onChange: (index: number) => void;
  /** Read out by screen readers, e.g. "Hour". */
  accessibilityLabel: string;
  /** Values that can't be picked, e.g. times already passed. They're faded and skipped. */
  isDisabled?: (index: number) => boolean;
};

/**
 * A swipeable row of values that works like the date strip: the one in the center is picked
 * once the strip comes to rest, it grows and gets a box, and each step gives a tick. Tapping a
 * value slides it in. Horizontal on purpose: a vertical wheel would fight the sheet's own
 * up / down drag.
 */
export function PickerStrip({ items, value, onChange, accessibilityLabel, isDisabled }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);

  const { step, scrollX, scrollProps, pick, recenter } = useSnapStrip({
    count: items.length,
    stepWidth: ITEM_WIDTH,
    initialIndex: value,
    value,
    onChange,
    scrollTo: (x, animated) => scrollRef.current?.scrollTo({ x, animated }),
    isDisabled,
  });

  // Screen readers step to the next value that can be picked.
  const stepBy = (direction: 1 | -1) => {
    for (let index = value + direction; index >= 0 && index < items.length; index += direction) {
      if (!isDisabled?.(index)) return pick(index);
    }
  };

  // Only where the strip starts. iOS jumps to a new contentOffset whenever it changes, which
  // would cut off the slide to a tapped value.
  const [initialOffset] = useState(() => ({ x: value * step, y: 0 }));

  // Once the width (and so the side padding) is known, put the picked value in the center.
  // (contentOffset below does this too, but not on every platform.)
  useEffect(() => {
    if (width > 0) recenter();
  }, [width, recenter]);

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
        stepBy(event.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
    >
      {width > 0 ? (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={initialOffset}
          // Side padding lets the first and last value reach the center.
          contentContainerStyle={{ paddingHorizontal: (width - step) / 2 }}
          {...scrollProps}
          // The strip as a whole is the screen-reader control (see above).
          importantForAccessibility="no-hide-descendants"
        >
          {items.map((label, index) => (
            <StripItem
              key={label}
              label={label}
              index={index}
              step={step}
              scrollX={scrollX}
              onPress={pick}
              disabled={isDisabled?.(index) ?? false}
            />
          ))}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}

type StripItemProps = {
  label: string;
  index: number;
  /** Width of a step, in points. */
  step: number;
  scrollX: Animated.Value;
  onPress: (index: number) => void;
  disabled: boolean;
};

const StripItem = memo(function StripItem({
  label,
  index,
  step,
  scrollX,
  onPress,
  disabled,
}: StripItemProps) {
  // How close this value is to the center: 0 = one step away (or more), 1 = centered.
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * step, index * step, (index + 1) * step];
    const between = (from: number, to: number) =>
      scrollX.interpolate({ inputRange, outputRange: [from, to, from], extrapolate: 'clamp' });
    return {
      boxOpacity: between(0, 1),
      boxScale: between(0.8, 1),
      labelScale: between(0.85, 1.2),
      labelOpacity: between(0.3, 1),
    };
  }, [scrollX, index, step]);

  return (
    <Pressable
      onPress={() => onPress(index)}
      disabled={disabled}
      style={[styles.item, { width: step }, disabled && styles.itemDisabled]}
    >
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Faded well below the other values, so it reads as out of reach.
  itemDisabled: {
    opacity: 0.35,
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
