import { useRouter } from 'expo-router';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import {
  GestureDetector,
  ScrollView as GestureScrollView,
  usePinchGesture,
} from 'react-native-gesture-handler';

import { priorityOf } from '@/components/TodoChips';
import { colors } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { formatTime, toDateKey, toDayMinutes, type DateKey } from '@/lib/dates';
import type { Todo } from '@/store/todos';

/** How tall an hour is, in points: fully zoomed out, at first, and fully zoomed in. */
const MIN_HOUR_HEIGHT = 48;
const DEFAULT_HOUR_HEIGHT = 64;
const MAX_HOUR_HEIGHT = 480;
/**
 * Time labels down the left get finer as you zoom in: every hour, 30 minutes, 15 minutes, then
 * 5 minutes. Each step shows once its labels are at least this far apart.
 */
const MIN_LABEL_GAP = 36;
const DIVISIONS = [5, 15, 30] as const;

/** Room on the left for the time labels. */
const GUTTER_WIDTH = 56;
/** Space above 12 am, so its label isn't cut off. */
const GRID_TOP = 10;
/** A todo has a time but no length, so each block is at least half an hour tall. */
const BLOCK_MINUTES = 30;
/** Space between blocks side by side, and below each one. */
const BLOCK_GAP = 2;
/** How much of the day shows above the time the timeline opens at. */
const LEAD_MINUTES = 60;

// The zoom is kept while the app is open, so switching views or days doesn't reset it.
let savedHourHeight = DEFAULT_HOUR_HEIGHT;

/** Minutes between time labels at this zoom: the finest step whose labels still fit. */
function divisionFor(hourHeight: number): number {
  return DIVISIONS.find((step) => (step / 60) * hourHeight >= MIN_LABEL_GAP) ?? 60;
}

/** "9 am" on the hour, "9:30" between hours. */
function tickLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour % 12 || 12;
  return minute === 0
    ? `${hour12} ${hour < 12 ? 'am' : 'pm'}`
    : `${hour12}:${String(minute).padStart(2, '0')}`;
}

/** Distance from the top of the grid to a time of day. */
function offsetOf(minutes: number, hourHeight: number): number {
  return GRID_TOP + (minutes / 60) * hourHeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type Block = {
  todo: Todo;
  /** Minutes since midnight. */
  start: number;
  /** Side-by-side position among blocks that overlap on screen: column of columns. */
  column: number;
  columns: number;
};

/**
 * Places the todos that have a time, like a calendar's day view: blocks that overlap share
 * the width, each in the leftmost column that's free at its start. `endOf` says where a
 * block ends, in minutes (it can be taller than half an hour when its title wraps).
 */
function layoutBlocks(todos: readonly Todo[], endOf: (todo: Todo, start: number) => number) {
  const timed = todos
    .filter((todo): todo is Todo & { dueTime: string } => todo.dueTime !== undefined)
    .map((todo) => ({ todo, start: toDayMinutes(todo.dueTime) }))
    .sort((a, b) => a.start - b.start || a.todo.createdAt - b.todo.createdAt);

  const blocks: Block[] = [];
  // The current run of overlapping blocks, and where each of its columns is free again.
  let group: Block[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const block of group) block.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };

  for (const { todo, start } of timed) {
    if (start >= groupEnd) closeGroup();
    const end = endOf(todo, start);
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;
    groupEnd = Math.max(groupEnd, end);

    const block = { todo, start, column, columns: 1 };
    group.push(block);
    blocks.push(block);
  }
  closeGroup();
  return blocks;
}

type Props = {
  /** The picked day's todos (already filtered by status). */
  todos: readonly Todo[];
  /** The picked day. */
  date: DateKey;
};

/**
 * The picked day as a timeline, like a calendar's day view: times down the left, each todo
 * with a time as a block at that time, tinted by priority. Todos without a time sit in an
 * "All day" row above. On today, a red line marks the current time.
 *
 * Pinch to zoom: the hours stretch, and the time labels go from every hour down to every 5
 * minutes. The time under your fingers stays put while zooming.
 * Opens scrolled to just before now (today), or the first todo with a time, or 8 am.
 * Tapping a todo opens its details sheet. Titles wrap in full; a block grows to fit its title.
 */
export function TodoTimeline({ todos, date }: Props) {
  const router = useRouter();
  const now = useNow();
  const isToday = date === toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [hourHeight, setHourHeight] = useState(savedHourHeight);
  const division = divisionFor(hourHeight);
  const ticks = useMemo(
    () => Array.from({ length: (24 * 60) / division }, (_, i) => i * division),
    [division],
  );

  // How tall each block's title and time are, as laid out. A block that's taller than half an
  // hour takes up more of the timeline, so blocks below it move aside instead of covering it.
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const measureBlock = (id: string, height: number) =>
    setContentHeights((current) =>
      Math.abs((current[id] ?? 0) - height) < 1 ? current : { ...current, [id]: height },
    );

  const blocks = useMemo(
    () =>
      layoutBlocks(todos, (todo, start) => {
        const height = (contentHeights[todo.id] ?? 0) + BLOCK_GAP;
        return start + Math.max(BLOCK_MINUTES, (height / hourHeight) * 60);
      }),
    [todos, contentHeights, hourHeight],
  );
  const allDay = todos.filter((todo) => todo.dueTime === undefined);

  const openTodo = (todo: Todo) =>
    router.push({ pathname: '/todo/[id]', params: { id: todo.id } });

  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);

  // Scroll to where the day starts once the timeline is on screen, and again for each new day.
  const [laidOut, setLaidOut] = useState(false);
  const scrollToStart = useEffectEvent(() => {
    const start = isToday ? nowMinutes : (blocks[0]?.start ?? 8 * 60);
    const y = Math.max(offsetOf(start - LEAD_MINUTES, hourHeight), 0);
    scrollRef.current?.scrollTo({ y, animated: false });
  });
  useEffect(() => {
    if (laidOut) scrollToStart();
  }, [date, laidOut]);

  // Pinch to zoom. The time under the fingers when the pinch starts stays under them: after
  // each zoom step, the timeline scrolls to put it back there.
  const [pinching, setPinching] = useState(false);
  const zoom = useRef({ startHeight: hourHeight, anchorMinutes: 0, focalY: 0, pending: false });
  const latestHourHeight = useRef(hourHeight);
  useEffect(() => {
    latestHourHeight.current = hourHeight;
    savedHourHeight = hourHeight;
  }, [hourHeight]);

  const pinch = usePinchGesture({
    runOnJS: true,
    disableReanimated: true,
    onActivate: (event) => {
      const height = latestHourHeight.current;
      zoom.current = {
        startHeight: height,
        anchorMinutes: ((scrollY.current + event.focalY - GRID_TOP) / height) * 60,
        focalY: event.focalY,
        pending: false,
      };
      setPinching(true);
    },
    onUpdate: (event) => {
      zoom.current.focalY = event.focalY;
      zoom.current.pending = true;
      setHourHeight(
        clamp(zoom.current.startHeight * event.scale, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT),
      );
    },
    onFinalize: () => setPinching(false),
  });

  useLayoutEffect(() => {
    const { anchorMinutes, focalY, pending } = zoom.current;
    if (!pending) return;
    zoom.current.pending = false;
    const y = Math.max(offsetOf(anchorMinutes, hourHeight) - focalY, 0);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [hourHeight]);

  return (
    <View style={styles.container}>
      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <Text style={styles.allDayLabel}>All day</Text>
          <ScrollView style={styles.allDayList} contentContainerStyle={styles.allDayContent}>
            {allDay.map((todo) => (
              <TimelineChip key={todo.id} todo={todo} onPress={() => openTodo(todo)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <GestureDetector gesture={pinch}>
        <GestureScrollView
          ref={scrollRef}
          simultaneousWith={pinch}
          // The pinch moves the timeline itself, so the usual scrolling waits until it's done.
          scrollEnabled={!pinching}
          onLayout={() => setLaidOut(true)}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.gridContent}
        >
          <View style={{ height: offsetOf(24 * 60, hourHeight) }}>
            {ticks.map((minutes) => {
              const onHour = minutes % 60 === 0;
              return (
                <View
                  key={minutes}
                  style={[styles.tickRow, { top: offsetOf(minutes, hourHeight) - 8 }]}
                >
                  <Text style={[styles.tickLabel, !onHour && styles.tickLabelMinor]}>
                    {tickLabel(minutes)}
                  </Text>
                  <View style={[styles.tickLine, !onHour && styles.tickLineMinor]} />
                </View>
              );
            })}

            {/* Blocks go in the area right of the labels; percentages split its width. */}
            <View style={styles.blocks}>
              {blocks.map(({ todo, start, column, columns }) => (
                <View
                  key={todo.id}
                  style={[
                    styles.blockSlot,
                    {
                      top: offsetOf(start, hourHeight) - GRID_TOP,
                      minHeight: (BLOCK_MINUTES / 60) * hourHeight,
                      left: `${(column / columns) * 100}%`,
                      width: `${100 / columns}%`,
                    },
                  ]}
                >
                  <TimelineChip
                    todo={todo}
                    onPress={() => openTodo(todo)}
                    onContentHeight={(height) => measureBlock(todo.id, height)}
                    showTime
                    fill
                  />
                </View>
              ))}
            </View>

            {isToday ? (
              <View
                style={[styles.nowLine, { top: offsetOf(nowMinutes, hourHeight) - 4 }]}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.nowDot} />
                <View style={styles.nowRule} />
              </View>
            ) : null}
          </View>
        </GestureScrollView>
      </GestureDetector>
    </View>
  );
}

/**
 * One todo on the timeline: a tinted box with a priority-colored edge, and the title in full
 * (it wraps). `fill` stretches it to its block; `showTime` adds the time after the title.
 * `onContentHeight` reports how tall the title and time are.
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
  const priority = priorityOf(todo);
  const time = showTime && todo.dueTime ? formatTime(todo.dueTime) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        fill && styles.chipFill,
        todo.completed
          ? styles.chipCompleted
          : { backgroundColor: priority.background, borderLeftColor: priority.color },
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
        <Text style={styles.chipText}>
          <Text style={[styles.chipTitle, todo.completed && styles.chipTitleCompleted]}>
            {todo.title}
          </Text>
          {time ? <Text style={styles.chipTime}>{`  ${time}`}</Text> : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  // Room below 11 pm for a block that starts late to run past midnight.
  gridContent: {
    paddingBottom: 64,
  },
  // A label centered on its time's line.
  tickRow: {
    position: 'absolute',
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
  // Between hours: smaller and lighter, so the hours still stand out.
  tickLabelMinor: {
    fontSize: 10,
    color: colors.textSubtle,
  },
  tickLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginEnd: 16,
    backgroundColor: colors.border,
  },
  tickLineMinor: {
    backgroundColor: colors.inputBackground,
  },
  blocks: {
    position: 'absolute',
    top: GRID_TOP,
    bottom: 0,
    left: GUTTER_WIDTH,
    right: 16,
  },
  // At least half an hour tall; taller if the title needs more lines.
  blockSlot: {
    position: 'absolute',
    paddingEnd: BLOCK_GAP,
    paddingBottom: BLOCK_GAP,
  },
  chip: {
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  chipFill: {
    flexGrow: 1,
  },
  chipContent: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipCompleted: {
    backgroundColor: colors.inputBackground,
    borderLeftColor: colors.textSubtle,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  chipTitle: {
    fontWeight: '600',
    color: colors.text,
  },
  chipTitleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  chipTime: {
    color: colors.textMuted,
  },
  // The current time: a dot on the edge of the time labels and a line across.
  nowLine: {
    position: 'absolute',
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
});
