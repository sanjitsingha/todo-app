import { useNavigation, useRoute, useRouter } from 'expo-router';
import { memo, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  ScrollView as GestureScrollView,
  usePinchGesture,
} from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { FAB_CLEARANCE } from '@/components/AddTodoFab';
import { priorityOf } from '@/components/TodoChips';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useNow } from '@/hooks/useNow';
import { formatTime, toDateKey, toDayMinutes, type DateKey } from '@/lib/dates';
import type { Todo } from '@/store/todos';

/**
 * How tall an hour is, in points: fully zoomed out, at first, and fully zoomed in. Zooming only
 * stretches the hours; the labels stay one per hour.
 */
const MIN_HOUR_HEIGHT = 48;
const DEFAULT_HOUR_HEIGHT = 64;
const MAX_HOUR_HEIGHT = 240;
/** The hours of the day, one label and line each. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Room on the left for the time labels. */
const GUTTER_WIDTH = 56;
/** Space above 12 am, so its label isn't cut off. */
const GRID_TOP = 10;
/** A todo has a time but no length, so a block reaches at most half an hour down. */
const BLOCK_MINUTES = 30;
/** Space below each block, so stacked blocks don't touch. */
const BLOCK_GAP = 2;
/** How tall a one-line title is, used until a block has been measured. */
const ONE_LINE_HEIGHT = 28;
/**
 * How much of the day shows above the time the timeline opens at: on today, the red now line
 * sits near the top with two hours above it.
 */
const LEAD_MINUTES = 120;

// The zoom is kept while the app is open, so switching views or days doesn't reset it.
let savedHourHeight = DEFAULT_HOUR_HEIGHT;
// The day pager keeps the days beside the one on screen drawn too, each with its own timeline.
// They take on a pinch once it ends, so the next day slides in at the same zoom.
const zoomFollowers = new Set<(height: number) => void>();

function saveZoom(height: number, from: (height: number) => void) {
  savedHourHeight = height;
  zoomFollowers.forEach((follow) => {
    if (follow !== from) follow(height);
  });
}

/** Gesture handler's scroll view (so it can scroll alongside the pinch), driven by Reanimated. */
const AnimatedScrollView = Animated.createAnimatedComponent(GestureScrollView);

/** "12 am", "9 am", "3 pm". */
function hourLabel(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
}

/** Distance from the top of the grid to a time of day. */
function offsetOf(minutes: number, hourHeight: number): number {
  'worklet';
  return GRID_TOP + (minutes / 60) * hourHeight;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/** A todo with a time, in the order the timeline shows them. */
type TimedTodo = { todo: Todo; start: number };

/** What laying out a block needs: its time (minutes since midnight) and its title's height. */
type BlockInput = { start: number; contentHeight: number };

/**
 * Where block `index` goes at this zoom: its distance from the top of the grid and its height
 * (gap included), in points. Blocks go down the timeline full width, one below another. Each
 * starts at its time and reaches down to the next todo's time (at most half an hour), but is
 * never shorter than its title. When todos are too close for that, the later ones are pushed
 * down to sit right under the one before, so they stack instead of going side by side. Zoomed
 * in far enough, every block is at its exact time.
 *
 * A block's place depends on the ones above it, so this walks down from the first. It runs on
 * the UI thread on every frame of a pinch, for a handful of blocks, so that's cheap.
 */
function blockPosition(
  inputs: readonly BlockInput[],
  index: number,
  hourHeight: number,
): { top: number; height: number } {
  'worklet';
  let top = 0;
  let height = 0;
  let previousBottom = 0;
  for (let i = 0; i <= index; i++) {
    const { start, contentHeight } = inputs[i];
    const next = inputs[i + 1];
    top = Math.max(offsetOf(start, hourHeight), previousBottom);
    const end = Math.min(
      offsetOf(start + BLOCK_MINUTES, hourHeight),
      next ? offsetOf(next.start, hourHeight) : Infinity,
    );
    height = Math.max(contentHeight + BLOCK_GAP, end - top);
    previousBottom = top + height;
  }
  return { top, height };
}

type Props = {
  /** The picked day's todos. */
  todos: readonly Todo[];
  /** The picked day. */
  date: DateKey;
};

/**
 * The picked day as a timeline, like a calendar's day view: times down the left, each todo
 * with a time as a block at that time, tinted by priority. Todos without a time sit in an
 * "All day" row above. On today, a red line marks the current time.
 *
 * Pinch to zoom: the hours stretch apart or squeeze together, with a label on each hour, and
 * the time under your fingers stays put. It all runs on the UI thread, so it follows your
 * fingers frame by frame: the zoom is a shared value that the hours, blocks and now line read
 * directly, without React re-rendering.
 * Opens with two hours showing above now (today), or above the first todo with a time, or
 * above 8 am, and goes back there after the app or another tab has been in front.
 * Tapping a todo opens its details sheet. Titles wrap in full; a block grows to fit its title.
 * Todos close together stack one below another.
 */
export function TodoTimeline({ todos, date }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const now = useNow();
  const isToday = date === toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hourHeight = useSharedValue(savedHourHeight);

  // Takes on a zoom pinched on another day's timeline.
  const [followZoom] = useState(() => (height: number) => hourHeight.set(height));
  useEffect(() => {
    zoomFollowers.add(followZoom);
    return () => {
      zoomFollowers.delete(followZoom);
    };
  }, [followZoom]);

  // How tall each block's title and time are, as laid out. A block is never shorter than its
  // title, so a block that needs more room pushes the ones after it down.
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const measureBlock = (id: string, height: number) =>
    setContentHeights((current) =>
      Math.abs((current[id] ?? 0) - height) < 1 ? current : { ...current, [id]: height },
    );

  const timed = useMemo(
    (): TimedTodo[] =>
      todos
        .filter((todo): todo is Todo & { dueTime: string } => todo.dueTime !== undefined)
        .map((todo) => ({ todo, start: toDayMinutes(todo.dueTime) }))
        .sort((a, b) => a.start - b.start || a.todo.createdAt - b.todo.createdAt),
    [todos],
  );
  const blockInputs = useMemo(
    (): BlockInput[] =>
      timed.map(({ todo, start }) => ({
        start,
        contentHeight: contentHeights[todo.id] ?? ONE_LINE_HEIGHT,
      })),
    [timed, contentHeights],
  );
  const allDay = todos.filter((todo) => todo.dueTime === undefined);

  // Todos stacked late in the day can run past midnight; the grid grows to keep them in reach.
  const gridHeight = useAnimatedStyle(() => {
    const height = hourHeight.get();
    const last = blockInputs.length - 1;
    const lastBlock = last >= 0 ? blockPosition(blockInputs, last, height) : null;
    return {
      height: Math.max(offsetOf(24 * 60, height), lastBlock ? lastBlock.top + lastBlock.height : 0),
    };
  });

  const openTodo = (todo: Todo) =>
    router.push({ pathname: '/todo/[id]', params: { id: todo.id } });

  const scrollRef = useAnimatedRef();
  const scrollOffset = useScrollOffset(scrollRef);

  // Scroll to where the day starts once the timeline is on screen, and again for each new day.
  // The time is read fresh here: coming back from the background, `now` hasn't caught up yet.
  const [laidOut, setLaidOut] = useState(false);
  const scrollToStart = useEffectEvent(() => {
    const current = new Date();
    const start =
      date === toDateKey(current)
        ? current.getHours() * 60 + current.getMinutes()
        : (timed[0]?.start ?? 8 * 60);
    const y = Math.max(offsetOf(start - LEAD_MINUTES, hourHeight.get()), 0);
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, y, false);
    });
  });
  useEffect(() => {
    if (laidOut) scrollToStart();
  }, [date, laidOut]);

  // Back to that start whenever the timeline comes back into sight: the app returning from the
  // background, or the Todo tab after another tab. Closing a sheet opened on top of it (add,
  // todo details) keeps your place, the same way the date strip keeps the picked day.
  const navigation = useNavigation();
  const route = useRoute();
  useEffect(() => {
    let wentToBackground = false;
    let wentToOtherTab = false;

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        wentToBackground = true;
      } else if (state === 'active' && wentToBackground) {
        wentToBackground = false;
        scrollToStart();
      }
    });
    // A sheet on top leaves this tab the active one; another tab doesn't.
    const removeBlur = navigation.addListener('blur', () => {
      const tabs = navigation.getState();
      wentToOtherTab = tabs !== undefined && tabs.routes[tabs.index]?.key !== route.key;
    });
    const removeFocus = navigation.addListener('focus', () => {
      if (!wentToOtherTab) return;
      wentToOtherTab = false;
      scrollToStart();
    });

    return () => {
      appState.remove();
      removeBlur();
      removeFocus();
    };
  }, [navigation, route.key]);

  // Pinch to zoom, on the UI thread. The time under the fingers when the pinch starts stays at
  // that spot on screen: each frame sets the new hour height and scrolls to put that time back
  // there. The spot is fixed at the start, not the moving midpoint of the fingers: when one
  // finger lifts before the other, the midpoint jumps to the finger left behind, and following
  // it would throw the timeline. Updates with fewer than two fingers down are ignored too.
  // React isn't involved at all; the zoom is only saved when the pinch ends.
  const pinchStartHeight = useSharedValue(savedHourHeight);
  const pinchAnchorMinutes = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const saveZoomFromHere = (height: number) => saveZoom(height, followZoom);

  const pinch = usePinchGesture({
    onActivate: (event) => {
      'worklet';
      const height = hourHeight.get();
      pinchStartHeight.set(height);
      pinchFocalY.set(event.focalY);
      pinchAnchorMinutes.set(((scrollOffset.get() + event.focalY - GRID_TOP) / height) * 60);
    },
    onUpdate: (event) => {
      'worklet';
      if (event.numberOfPointers < 2) return;
      const height = clamp(pinchStartHeight.get() * event.scale, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT);
      hourHeight.set(height);
      const y = Math.max(offsetOf(pinchAnchorMinutes.get(), height) - pinchFocalY.get(), 0);
      scrollTo(scrollRef, 0, y, false);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(saveZoomFromHere, hourHeight.get());
    },
  });

  return (
    <View style={styles.container}>
      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <Text style={styles.allDayLabel}>All day</Text>
          <ScrollView
            style={styles.allDayList}
            contentContainerStyle={styles.allDayContent}
            showsVerticalScrollIndicator={false}
          >
            {allDay.map((todo) => (
              <TimelineChip key={todo.id} todo={todo} onPress={() => openTodo(todo)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <GestureDetector gesture={pinch}>
        <AnimatedScrollView
          ref={scrollRef}
          // A pinch takes over from scrolling: the scroll view's drag is cancelled the moment the
          // pinch starts, so it doesn't fight the zoom, fling afterwards, or jump when one finger
          // stays down after the other lifts. The next touch scrolls as usual.
          yieldsToContinuousGestures
          onLayout={() => setLaidOut(true)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        >
          <Animated.View style={gridHeight}>
            {HOURS.map((hour) => (
              <HourRow key={hour} hour={hour} hourHeight={hourHeight} />
            ))}

            {/* Blocks go in the area right of the labels, across its full width. */}
            <View style={styles.blocks}>
              {timed.map(({ todo }, index) => (
                <TimelineBlock
                  key={todo.id}
                  inputs={blockInputs}
                  index={index}
                  hourHeight={hourHeight}
                >
                  <TimelineChip
                    todo={todo}
                    onPress={() => openTodo(todo)}
                    onContentHeight={(height) => measureBlock(todo.id, height)}
                    showTime
                    fill
                  />
                </TimelineBlock>
              ))}
            </View>

            {isToday ? <NowLine minutes={nowMinutes} hourHeight={hourHeight} /> : null}
          </Animated.View>
        </AnimatedScrollView>
      </GestureDetector>
    </View>
  );
}

/**
 * One hour's label and line. It moves with a transform rather than `top`, so zooming doesn't
 * make the layout recalculate for every row on every frame.
 */
const HourRow = memo(function HourRow({
  hour,
  hourHeight,
}: {
  hour: number;
  hourHeight: SharedValue<number>;
}) {
  const styles = useStyles();
  const position = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetOf(hour * 60, hourHeight.get()) - 8 }],
  }));

  return (
    <Animated.View style={[styles.tickRow, position]}>
      <Text style={styles.tickLabel}>{hourLabel(hour)}</Text>
      <View style={styles.tickLine} />
    </Animated.View>
  );
});

/** Holds one todo's block at its place on the timeline, following the zoom. */
function TimelineBlock({
  inputs,
  index,
  hourHeight,
  children,
}: {
  inputs: readonly BlockInput[];
  index: number;
  hourHeight: SharedValue<number>;
  children: ReactNode;
}) {
  const styles = useStyles();
  const position = useAnimatedStyle(() => {
    const { top, height } = blockPosition(inputs, index, hourHeight.get());
    return { height, transform: [{ translateY: top - GRID_TOP }] };
  });

  return <Animated.View style={[styles.blockSlot, position]}>{children}</Animated.View>;
}

/** The current time: a dot on the edge of the time labels and a line across. */
function NowLine({ minutes, hourHeight }: { minutes: number; hourHeight: SharedValue<number> }) {
  const styles = useStyles();
  const position = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetOf(minutes, hourHeight.get()) - 4 }],
  }));

  return (
    <Animated.View
      style={[styles.nowLine, position]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.nowDot} />
      <View style={styles.nowRule} />
    </Animated.View>
  );
}

/**
 * One todo on the timeline: a box tinted by priority, with the title in full (it wraps) in a
 * deep shade of the same color. Done todos are gray. `fill` stretches it to its block;
 * `showTime` puts the time on the right. `onContentHeight` reports how tall the title and time
 * are.
 */
function TimelineChip({
  todo,
  onPress,
  onContentHeight,
  showTime = false,
  fill = false,
}: {
  todo: Todo;
  onPress: () => void;
  onContentHeight?: (height: number) => void;
  showTime?: boolean;
  fill?: boolean;
}) {
  const styles = useStyles();
  const priority = priorityOf(todo, useColors());
  const time = showTime && todo.dueTime ? formatTime(todo.dueTime) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        fill && styles.chipFill,
        todo.completed ? styles.chipCompleted : { backgroundColor: priority.background },
        pressed && styles.chipPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${todo.title}${time ? `, ${time}` : ''}, ${priority.label} priority${
        todo.completed ? ', done' : ''
      }`}
      accessibilityHint="Opens the todo's details"
    >
      <View
        style={styles.chipContent}
        onLayout={
          onContentHeight
            ? (event) => onContentHeight(event.nativeEvent.layout.height)
            : undefined
        }
      >
        <Text
          style={[
            styles.chipText,
            styles.chipTitle,
            todo.completed ? styles.chipTitleCompleted : { color: priority.deep },
          ]}
        >
          {todo.title}
        </Text>
        {time ? (
          <Text
            style={[styles.chipText, styles.chipTime, !todo.completed && { color: priority.deep }]}
          >
            {time}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: {
    flex: 1,
  },
  allDay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingBottom: 8,
    paddingEnd: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  allDayLabel: {
    width: GUTTER_WIDTH,
    paddingTop: 6,
    paddingEnd: 8,
    textAlign: 'right',
    fontSize: 11,
    color: colors.textMuted,
  },
  // A few rows at most; more scroll inside it, so the hours stay in view.
  allDayList: {
    flex: 1,
    maxHeight: 112,
  },
  allDayContent: {
    gap: 4,
  },
  // Room below 11 pm for a block that starts late to run past midnight, and for the last hours
  // to scroll up clear of the Add todo button.
  gridContent: {
    paddingBottom: FAB_CLEARANCE,
  },
  // A label centered on its time's line; moved down to it with a transform.
  tickRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickLabel: {
    width: GUTTER_WIDTH,
    paddingEnd: 8,
    textAlign: 'right',
    fontSize: 11,
    color: colors.textMuted,
  },
  tickLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginEnd: 16,
    backgroundColor: colors.border,
  },
  blocks: {
    position: 'absolute',
    top: GRID_TOP,
    bottom: 0,
    left: GUTTER_WIDTH,
    right: 16,
  },
  // Full width; its place and height (gap included) come from blockPosition.
  blockSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: BLOCK_GAP,
  },
  chip: {
    borderRadius: 6,
  },
  chipFill: {
    flexGrow: 1,
  },
  // The title on the left, wrapping; the time at the top right.
  chipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipCompleted: {
    backgroundColor: colors.inputBackground,
  },
  chipPressed: {
    opacity: 0.7,
  },
  // The same line height for title and time, so the time lines up with the title's first line.
  chipText: {
    lineHeight: 18,
  },
  chipTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  chipTitleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  chipTime: {
    flexShrink: 0,
    fontSize: 12,
    color: colors.textMuted,
  },
  // Moved down to the current time with a transform.
  nowLine: {
    position: 'absolute',
    top: 0,
    left: GUTTER_WIDTH - 4,
    right: 16,
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
    // Taps go through to the blocks under it.
    pointerEvents: 'none',
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  nowRule: {
    flex: 1,
    height: 2,
    backgroundColor: colors.danger,
  },
}));
