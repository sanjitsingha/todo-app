// Just these icons, not the whole icon set.
import Trash2 from 'lucide-react-native/icons/trash-2';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  STICKY_FONT_SIZE,
  STICKY_LINE_HEIGHT,
  STICKY_MAX_LINES,
  STICKY_PADDING,
  STICKY_RADIUS,
  STICKY_SIZE,
  stickyFill,
} from '@/constants/sticky';
import { colors } from '@/constants/theme';
import type { WallSize } from '@/lib/stickyLayout';
import type { Sticky, StickyColor } from '@/store/stickies';

/** How much bigger a sticky gets while it's held, as a share of its size. */
const LIFT_GROWTH = 0.06;
/** Held over the bin, a sticky shrinks by this share, as if about to drop in. */
const BIN_SHRINK = 0.4;
const BIN_SIZE = 64;
/** From the bottom of the wall to the bottom of the bin. */
const BIN_BOTTOM = 28;
/** A sticky whose middle comes this close to the bin's middle is over it. */
const BIN_REACH = 80;
/** Fingers have to move this far before a touch on a sticky becomes a drag (less is a tap). */
const DRAG_DISTANCE = 6;

/** Picking up: quick, with a little give. */
const LIFT_SPRING = { duration: 260, dampingRatio: 0.7 };
/** Putting down: it settles where it's dropped, with a small bounce, like being pressed on. */
const SETTLE_SPRING = { duration: 380, dampingRatio: 0.72 };
const BIN_SPRING = { duration: 240, dampingRatio: 0.8 };
const FADE = { duration: 180 };
const VANISH = { duration: 240, easing: Easing.in(Easing.cubic) };

/**
 * A sticky's shadow, for a sticky drawn `scale` times its size on the wall (the editor draws it
 * bigger), so it looks the same once scaled back down: tight under the paper, softer around it.
 */
export function stickyShadow(scale = 1): string {
  const px = (value: number) => `${value * scale}px`;
  return (
    `0 ${px(1)} ${px(2)} rgba(15, 23, 42, 0.10), ` +
    `0 ${px(4)} ${px(10)} rgba(15, 23, 42, 0.08)`
  );
}

/** The deeper shadow of a sticky held up off the wall. */
const LIFTED_SHADOW = '0 14px 28px rgba(15, 23, 42, 0.20)';

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/** The middle of the bin, in points from the wall's top-left. */
function binCenter(wall: WallSize): { x: number; y: number } {
  'worklet';
  return { x: wall.width / 2, y: wall.height - BIN_BOTTOM - BIN_SIZE / 2 };
}

/** True while a sticky with its top-left at (x, y) is held over the bin. */
function isOverBin(x: number, y: number, wall: WallSize): boolean {
  'worklet';
  const bin = binCenter(wall);
  const dx = x + STICKY_SIZE / 2 - bin.x;
  const dy = y + STICKY_SIZE / 2 - bin.y;
  return dx * dx + dy * dy < BIN_REACH * BIN_REACH;
}

/**
 * What every sticky shares while one is dragged, on the UI thread, so a drag never waits on
 * React: which one it is, where it is, how far it's lifted, and whether it's over the bin.
 */
export type StickyDrag = {
  /** The sticky being dragged, or settling after; '' before the first drag. */
  id: SharedValue<string>;
  /** Its top-left corner, in points from the wall's top-left. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** Where it was when the drag began. */
  startX: SharedValue<number>;
  startY: SharedValue<number>;
  /** 0 → 1 as it's picked up: it grows a little, straightens, and its shadow deepens. */
  lift: SharedValue<number>;
  /** 0 → 1 while a finger is on it: the bin comes up and the Add sticky button fades. */
  active: SharedValue<number>;
  /** 1 while it's held over the bin, 0 otherwise. */
  overBin: SharedValue<number>;
  /** The same, eased: the bin grows and turns red, the sticky shrinks. */
  binness: SharedValue<number>;
  /** 0 → 1 as it drops into the bin and disappears. */
  vanish: SharedValue<number>;
  /** The wall's size, to keep stickies on it and find the bin. */
  wall: SharedValue<WallSize>;
};

export function useStickyDrag(): StickyDrag {
  return {
    id: useSharedValue(''),
    x: useSharedValue(0),
    y: useSharedValue(0),
    startX: useSharedValue(0),
    startY: useSharedValue(0),
    lift: useSharedValue(0),
    active: useSharedValue(0),
    overBin: useSharedValue(0),
    binness: useSharedValue(0),
    vanish: useSharedValue(0),
    wall: useSharedValue({ width: 0, height: 0 }),
  };
}

/**
 * A sticky as it looks on the wall: a square of colored paper with its text, at STICKY_SIZE.
 * Fills its parent, which places and turns it.
 */
function StickyFace({ text, color }: { text: string; color: StickyColor }) {
  return (
    <View style={[styles.face, { backgroundColor: stickyFill(color) }]}>
      <Text style={styles.text} numberOfLines={STICKY_MAX_LINES}>
        {text}
      </Text>
    </View>
  );
}

type WallStickyProps = {
  sticky: Sticky;
  drag: StickyDrag;
  /**
   * Kept in place but not shown: while it's open in the editor, or while it's dragged (the
   * copy on top, DraggedSticky, shows instead).
   */
  hidden: boolean;
  onOpen: (id: string) => void;
  /** A drag began: show the copy on top. */
  onDragStart: (id: string) => void;
  /** Dropped on the wall at (x, y), its new place: save it and put it on top of the others. */
  onDrop: (id: string, x: number, y: number) => void;
  /** Done settling after a drop. */
  onSettled: (id: string) => void;
  /** Dropped into the bin, and gone from view. */
  onBin: (id: string) => void;
  /** Just moved over the bin. */
  onBinHover: () => void;
};

/**
 * A sticky on the wall. Tap it to open it in the editor; drag it to move it, anywhere on the
 * wall, or onto the bin that comes up at the bottom to take it down. The drag runs on the UI
 * thread: held, it grows a little, straightens and casts a deeper shadow; let go, it settles
 * into place leaning as before, kept on the wall.
 *
 * While it's dragged, a copy above every other sticky (DraggedSticky) shows instead of it, so it
 * never slides under another. It only moves above the others in the list once let go, since
 * reordering views mid-drag would cancel the touch.
 */
export function WallSticky({
  sticky,
  drag,
  hidden,
  onOpen,
  onDragStart,
  onDrop,
  onSettled,
  onBin,
  onBinHover,
}: WallStickyProps) {
  const { id, x, y, rotation } = sticky;

  const pan = usePanGesture({
    minDistance: DRAG_DISTANCE,
    onActivate: () => {
      'worklet';
      drag.id.set(id);
      drag.startX.set(x);
      drag.startY.set(y);
      drag.x.set(x);
      drag.y.set(y);
      drag.overBin.set(0);
      drag.binness.set(0);
      drag.vanish.set(0);
      drag.lift.set(withSpring(1, LIFT_SPRING));
      drag.active.set(withTiming(1, FADE));
      scheduleOnRN(onDragStart, id);
    },
    onUpdate: (event) => {
      'worklet';
      const nextX = drag.startX.get() + event.translationX;
      const nextY = drag.startY.get() + event.translationY;
      drag.x.set(nextX);
      drag.y.set(nextY);
      const over = isOverBin(nextX, nextY, drag.wall.get());
      if (over !== (drag.overBin.get() === 1)) {
        drag.overBin.set(over ? 1 : 0);
        drag.binness.set(withSpring(over ? 1 : 0, BIN_SPRING));
        if (over) scheduleOnRN(onBinHover);
      }
    },
    onDeactivate: () => {
      'worklet';
      drag.active.set(withTiming(0, FADE));
      const wall = drag.wall.get();

      // Into the bin: it shrinks away into it, then it's taken off the wall.
      if (drag.overBin.get() === 1) {
        const bin = binCenter(wall);
        drag.x.set(withTiming(bin.x - STICKY_SIZE / 2, VANISH));
        drag.y.set(withTiming(bin.y - STICKY_SIZE / 2, VANISH));
        drag.vanish.set(
          withTiming(1, VANISH, () => {
            scheduleOnRN(onBin, id);
          }),
        );
        return;
      }

      // Onto the wall, kept wholly on it. The new place is saved straight away; the copy on
      // top stays until it has settled there.
      const finalX = clamp(drag.x.get(), 0, Math.max(0, wall.width - STICKY_SIZE));
      const finalY = clamp(drag.y.get(), 0, Math.max(0, wall.height - STICKY_SIZE));
      scheduleOnRN(onDrop, id, finalX, finalY);
      drag.x.set(withSpring(finalX, SETTLE_SPRING));
      drag.y.set(withSpring(finalY, SETTLE_SPRING));
      drag.lift.set(
        withSpring(0, SETTLE_SPRING, () => {
          scheduleOnRN(onSettled, id);
        }),
      );
    },
  });

  const tap = useTapGesture({ runOnJS: true, onActivate: () => onOpen(id) });
  const gesture = useCompetingGestures(pan, tap);

  // Follows the drag while it's the one dragged (until the copy on top takes over, a frame or
  // so in), and sits at its saved place otherwise.
  const placed = useAnimatedStyle(() => {
    const dragged = drag.id.get() === id;
    const lift = dragged ? drag.lift.get() : 0;
    return {
      transform: [
        { translateX: dragged ? drag.x.get() : x },
        { translateY: dragged ? drag.y.get() : y },
        { rotate: `${rotation * (1 - lift)}deg` },
        { scale: 1 + LIFT_GROWTH * lift },
      ],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.sticky, placed, hidden && styles.hidden]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={sticky.text.trim() || 'Empty sticky'}
        accessibilityHint="Opens the sticky. Drag it to move it, or onto the bin to remove it."
        accessibilityActions={[{ name: 'activate' }, { name: 'delete', label: 'Remove' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onOpen(id);
          if (event.nativeEvent.actionName === 'delete') onBin(id);
        }}
      >
        <StickyFace text={sticky.text} color={sticky.color} />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The sticky being dragged, drawn above every other one: lifted, with a deeper shadow,
 * shrinking over the bin, and shrinking away into it when dropped there. Taps go through it.
 */
export function DraggedSticky({ sticky, drag }: { sticky: Sticky; drag: StickyDrag }) {
  const placed = useAnimatedStyle(() => {
    const lift = drag.lift.get();
    const binness = drag.binness.get();
    const vanish = drag.vanish.get();
    return {
      opacity: (1 - 0.2 * binness) * (1 - vanish),
      transform: [
        { translateX: drag.x.get() },
        { translateY: drag.y.get() },
        { rotate: `${sticky.rotation * (1 - lift)}deg` },
        { scale: (1 + LIFT_GROWTH * lift) * (1 - BIN_SHRINK * binness) * (1 - 0.5 * vanish) },
      ],
    };
  });
  const liftedShadow = useAnimatedStyle(() => ({ opacity: drag.lift.get() }));

  return (
    <Animated.View style={[styles.sticky, placed]} pointerEvents="none" aria-hidden>
      <Animated.View
        style={[styles.liftedShadow, { backgroundColor: stickyFill(sticky.color) }, liftedShadow]}
      />
      <StickyFace text={sticky.text} color={sticky.color} />
    </Animated.View>
  );
}

/**
 * The bin at the bottom of the wall. It rises in while a sticky is dragged, and grows and
 * turns red while one is held over it.
 */
export function StickyBin({ drag }: { drag: StickyDrag }) {
  const bin = useAnimatedStyle(() => {
    const shown = drag.active.get();
    const hover = drag.binness.get();
    return {
      opacity: shown,
      backgroundColor: interpolateColor(hover, [0, 1], [colors.surface, colors.danger]),
      transform: [
        { translateY: (1 - shown) * 16 },
        { scale: (0.85 + 0.15 * shown) * (1 + 0.2 * hover) },
      ],
    };
  });
  const redIcon = useAnimatedStyle(() => ({ opacity: 1 - drag.binness.get() }));
  const whiteIcon = useAnimatedStyle(() => ({ opacity: drag.binness.get() }));

  return (
    <Animated.View style={[styles.bin, bin]} pointerEvents="none" aria-hidden>
      <Animated.View style={[styles.binIcon, redIcon]}>
        <Trash2 size={24} color={colors.danger} />
      </Animated.View>
      <Animated.View style={[styles.binIcon, whiteIcon]}>
        <Trash2 size={24} color={colors.onInk} />
      </Animated.View>
    </Animated.View>
  );
}

/** Lets the Add sticky button fade out while a sticky is dragged, to make room for the bin. */
export function useHiddenWhileDragging(drag: StickyDrag) {
  return useAnimatedStyle(() => ({ opacity: 1 - drag.active.get() }));
}

const styles = StyleSheet.create({
  // Placed by its transform, from the wall's top-left.
  sticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: STICKY_SIZE,
    height: STICKY_SIZE,
  },
  hidden: {
    opacity: 0,
  },
  face: {
    flex: 1,
    padding: STICKY_PADDING,
    borderRadius: STICKY_RADIUS,
    boxShadow: stickyShadow(),
  },
  text: {
    fontSize: STICKY_FONT_SIZE,
    lineHeight: STICKY_LINE_HEIGHT,
    fontWeight: '500',
    color: colors.ink,
  },
  // Same size and color as the sticky, right behind it: only its shadow shows.
  liftedShadow: {
    ...StyleSheet.absoluteFill,
    borderRadius: STICKY_RADIUS,
    boxShadow: LIFTED_SHADOW,
  },
  bin: {
    position: 'absolute',
    bottom: BIN_BOTTOM,
    left: '50%',
    width: BIN_SIZE,
    height: BIN_SIZE,
    marginLeft: -BIN_SIZE / 2,
    borderRadius: BIN_SIZE / 2,
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.16)',
  },
  binIcon: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
