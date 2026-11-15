import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { tick } from '@/lib/feedback';

/** Ticks closer together than this blur into a buzz, so a fast fling skips some. */
const MIN_TICK_GAP_MS = 35;
/**
 * When a finger lifts and no fling or snap follows (one almost always does, and reports its
 * own end), the strip is at rest where the finger left it. This is how long to wait to be sure.
 */
const SETTLE_DELAY_MS = 100;

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

type Options = {
  /** How many steps the strip has. */
  count: number;
  /** About how wide one step is. The real width is rounded to whole pixels (see below). */
  stepWidth: number;
  /** The step in the center on the first render. */
  initialIndex: number;
  /** The picked step, as the parent has it. Undefined leaves the strip where it is. */
  value: number | undefined;
  /** A swipe came to rest on another step, or one was tapped. */
  onChange: (index: number) => void;
  /** Scrolls the strip's list to an x offset. */
  scrollTo: (x: number, animated: boolean) => void;
  /** Steps that can't be picked (e.g. times already passed). A swipe never rests on one. */
  isDisabled?: (index: number) => boolean;
};

/**
 * The scrolling behind the date strip and the time picker strips: a horizontal list of equal
 * steps where the one in the center is picked.
 *
 * - The scroll position runs the animations on the native side (`scrollX`), so they stay smooth.
 * - Each step that crosses the center ticks (src/lib/feedback.ts) as it happens.
 * - The parent only hears about the pick once the strip comes to rest, or on a tap. Picking on
 *   every tick re-rendered the whole screen mid-swipe, which made the ticks lag, and a late
 *   render would drag the strip back to a day it had already passed.
 * - A new `value` from outside (not from this strip) slides the strip to it.
 * - Disabled steps are skipped: no tick, no tap, and a swipe that stops on one slides on to the
 *   nearest step that can be picked.
 */
export function useSnapStrip({
  count,
  stepWidth,
  initialIndex,
  value,
  onChange,
  scrollTo,
  isDisabled,
}: Options) {
  // Android turns `snapToInterval` into pixels by dropping the fraction: 52 points on a 2.625x
  // screen is 136.5 pixels, but it snaps every 136. The shortfall adds up with every step, and a
  // year into the date strip a swipe stopped between two days, with both half highlighted. So
  // steps are whole pixels wide, and Android gets half a pixel extra to drop.
  const { scale } = useWindowDimensions();
  const stepPixels = Math.round(stepWidth * scale);
  const step = stepPixels / scale;
  const snapToInterval = Platform.OS === 'android' ? (stepPixels + 0.5) / scale : step;

  const [scrollX] = useState(() => new Animated.Value(initialIndex * step));

  // Scroll callbacks read these, so they always reach the latest ones.
  const latest = useRef({ onChange, scrollTo, isDisabled });
  useEffect(() => {
    latest.current = { onChange, scrollTo, isDisabled };
  });

  const strip = useRef({
    /** The step under the center, as last seen from scroll updates. */
    centered: initialIndex,
    /** The step the parent has, as far as the strip knows. */
    picked: initialIndex,
    /** Where the strip is sliding by itself (after a tap or an outside change), if it is. */
    slideTarget: null as number | null,
    dragging: false,
    lastTickAt: 0,
    settleTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  const indexAt = useCallback(
    (x: number) => Math.min(Math.max(Math.round(x / step), 0), count - 1),
    [step, count],
  );

  const slideTo = useCallback(
    (index: number) => {
      const s = strip.current;
      // The strip stays quiet while it slides by itself: the target is already picked.
      s.slideTarget = index === s.centered ? null : index;
      latest.current.scrollTo(index * step, true);
    },
    [step],
  );

  /** The closest step to `index` that can be picked (a later one on a tie), or null if none. */
  const nearestEnabled = useCallback(
    (index: number) => {
      const disabled = latest.current.isDisabled;
      if (!disabled?.(index)) return index;
      for (let distance = 1; distance < count; distance++) {
        for (const candidate of [index + distance, index - distance]) {
          if (candidate >= 0 && candidate < count && !disabled(candidate)) return candidate;
        }
      }
      return null;
    },
    [count],
  );

  // The strip stopped moving at `x`: pick the step there.
  const settle = useCallback(
    (x: number) => {
      const s = strip.current;
      clearTimeout(s.settleTimer);
      if (s.dragging) return;

      const under = indexAt(x);
      // A disabled step slides on to the nearest one that can be picked. If there's none,
      // the strip just rests and nothing is picked.
      const enabled = nearestEnabled(under);
      const index = enabled ?? under;
      // Never rest between two steps.
      if (Math.abs(x - index * step) > 1) latest.current.scrollTo(index * step, true);

      if (enabled !== null && s.slideTarget === null && index !== s.picked) {
        s.picked = index;
        latest.current.onChange(index);
      }
    },
    [indexAt, nearestEnabled, step],
  );

  // Each time a new step crosses the center during a swipe, tick (but not for disabled ones).
  useEffect(() => {
    const id = scrollX.addListener(({ value: x }) => {
      const s = strip.current;
      const index = indexAt(x);
      if (index === s.centered) return;
      s.centered = index;

      if (s.slideTarget !== null) {
        if (index === s.slideTarget) s.slideTarget = null;
        return;
      }
      if (latest.current.isDisabled?.(index)) return;
      const now = Date.now();
      if (now - s.lastTickAt < MIN_TICK_GAP_MS) return;
      s.lastTickAt = now;
      tick();
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, indexAt]);

  // The parent picked a step itself (not through this strip): slide to it. Left alone while a
  // finger is on the strip; the swipe picks a step when it ends.
  useEffect(() => {
    const s = strip.current;
    if (value === undefined || value === s.picked) return;
    s.picked = value;
    if (!s.dragging) slideTo(value);
  }, [value, slideTo]);

  useEffect(() => {
    const s = strip.current;
    return () => clearTimeout(s.settleTimer);
  }, []);

  /** Picks a step and slides it to the center, as for a tap. Disabled steps are ignored. */
  const pick = useCallback(
    (index: number) => {
      if (index < 0 || index >= count || latest.current.isDisabled?.(index)) return;
      const s = strip.current;
      if (index !== s.picked) {
        tick();
        s.picked = index;
        latest.current.onChange(index);
      }
      // Even when it's already picked: a tap that stops a fling can leave the strip between steps.
      slideTo(index);
    },
    [count, slideTo],
  );

  /** Puts the picked step in the center at once, e.g. once the strip's width is known. */
  const recenter = useCallback(() => {
    latest.current.scrollTo(strip.current.picked * step, false);
  }, [step]);

  const scrollProps = useMemo(
    () => ({
      snapToInterval,
      decelerationRate: 'fast' as const,
      scrollEventThrottle: 16,
      onScroll: Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
      onScrollBeginDrag: () => {
        const s = strip.current;
        s.dragging = true;
        // A swipe takes over from a slide in progress.
        s.slideTarget = null;
        clearTimeout(s.settleTimer);
      },
      onScrollEndDrag: (event: ScrollEvent) => {
        const s = strip.current;
        s.dragging = false;
        const x = event.nativeEvent.contentOffset.x;
        s.settleTimer = setTimeout(() => settle(x), SETTLE_DELAY_MS);
      },
      onMomentumScrollBegin: () => clearTimeout(strip.current.settleTimer),
      onMomentumScrollEnd: (event: ScrollEvent) => settle(event.nativeEvent.contentOffset.x),
    }),
    [snapToInterval, scrollX, settle],
  );

  return { step, scrollX, scrollProps, pick, recenter };
}
