import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { DAY_BOX_RADIUS, DAY_BOX_SIZE } from '@/components/DateStrip';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useSnapStrip } from '@/hooks/useSnapStrip';

const ITEM_WIDTH = 52;
const STRIP_HEIGHT = 44;
/**
 * A square with just room for a two-digit value at full magnification: the date strip's box,
 * scaled up, with its corners scaled to match so it's the same shape.
 */
const BOX_SIZE = 36;
const BOX_RADIUS = Math.round(BOX_SIZE * (DAY_BOX_RADIUS / DAY_BOX_SIZE));
/** How far in from each end the values fade out. */
const FADE_WIDTH = 64;

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
 * once the strip comes to rest, it's magnified and gets a snug soft gray box (the same as the
 * picked day in the date strip), and each step gives a tick. Tapping a value slides it in.
 * Horizontal on purpose: a vertical wheel would fight the sheet's own up / down drag.
 */
export function PickerStrip({ items, value, onChange, accessibilityLabel, isDisabled }: Props) {
  const styles = useStyles();
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

      {/* The values fade out toward both ends. Taps go through to them. */}
      <EdgeFade side="left" />
      <EdgeFade side="right" />
    </View>
  );
}

/**
 * A white-to-clear gradient over one end of the strip, drawn with SVG (no extra native module
 * needed). White matches the sheets the strips sit on.
 */
function EdgeFade({ side }: { side: 'left' | 'right' }) {
  const styles = useStyles();
  const colors = useColors();
  const id = `picker-strip-fade-${side}`;
  // Solid at the outer edge, clear toward the middle.
  const [from, to] = side === 'left' ? [1, 0] : [0, 1];
  return (
    <Svg
      width={FADE_WIDTH}
      height={STRIP_HEIGHT}
      style={[styles.fade, side === 'left' ? styles.fadeLeft : styles.fadeRight]}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.surface} stopOpacity={from} />
          <Stop offset="1" stopColor={colors.surface} stopOpacity={to} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
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
  const styles = useStyles();
  // How close this value is to the center: 0 = one step away (or more), 1 = centered.
  const animated = useMemo(() => {
    const inputRange = [(index - 1) * step, index * step, (index + 1) * step];
    const between = (from: number, to: number) =>
      scrollX.interpolate({ inputRange, outputRange: [from, to, from], extrapolate: 'clamp' });
    return {
      boxOpacity: between(0, 1),
      boxScale: between(0.8, 1),
      // The picked value is magnified well above its neighbors.
      labelScale: between(0.8, 1.4),
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

const useStyles = createThemedStyles((colors) => ({
  // Fixed height, so nothing jumps while the width is being measured.
  container: {
    height: STRIP_HEIGHT,
  },
  item: {
    height: STRIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Over each end of the strip; taps pass through to the values underneath.
  fade: {
    position: 'absolute',
    top: 0,
    pointerEvents: 'none',
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
  // Faded well below the other values, so it reads as out of reach.
  itemDisabled: {
    opacity: 0.35,
  },
  // The same soft gray square as the picked day in the date strip, just hugging the magnified
  // value. Centered in its step.
  box: {
    position: 'absolute',
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: BOX_RADIUS,
    backgroundColor: colors.inkSoft,
  },
  // The date strip's date size, before it's magnified.
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
}));
