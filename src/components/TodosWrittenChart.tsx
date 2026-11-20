import { useIsFocused } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as RNScrollView,
} from 'react-native';
import { BarChart, type BarChartProps, type BarChartRenderBarProps } from 'react-native-chart-kit/v2';
import { GestureDetector, ScrollView, usePinchGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { G, Rect } from 'react-native-svg';

import type { ThemeColors } from '@/constants/theme';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useNow } from '@/hooks/useNow';
import {
  WEEKDAYS,
  addDays,
  formatDayMonth,
  formatHour,
  toDateKey,
  type DateKey,
} from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos } from '@/store/todos';

/**
 * What the chart covers: today hour by hour, or day by day over the last 7 or 30 days, ending
 * today.
 */
export type ChartRange = 'today' | 'week' | 'month';

const HOURS = 24;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

/** For screen readers, before the counts. */
const RANGE_DESCRIPTIONS: Record<ChartRange, string> = {
  today: 'Todos written today, by hour',
  week: 'Todos written each day, last 7 days',
  month: 'Todos written each day, last 30 days',
};

const CHART_HEIGHT = 220;
/**
 * At first, this many columns fill the chart's width, as on Week, so the columns start out
 * just as thick in every range; Today and Month scroll to show the rest.
 */
const DEFAULT_VISIBLE_COLUMNS = 7;
/** Pinched all the way in, this many fill the width. Pinched all the way out, they all fit. */
const MIN_VISIBLE_COLUMNS = 3;
/** Columns start out no wider than this; the rest of each column's slot is air. */
const COLUMN_MAX_WIDTH = 32;
/** Nor more than this share of their slot, so there's always a gap between them. */
const COLUMN_MAX_RATIO = 0.75;
/** Every corner is rounded, top and bottom. */
const COLUMN_RADIUS = 4;
/**
 * No column is shorter than this, so an hour or day with nothing written still shows, as a
 * gray stub sitting on 0, and one with very little never looks empty.
 */
const MIN_COLUMN_HEIGHT = 4;
/** While a column is picked, the others fade back to this. */
const FADED_OPACITY = 0.3;
/** How long the columns take to grow up from 0 when the chart comes into view. */
const GROW_DURATION_MS = 600;

/**
 * Which columns get their hour or day written under them: every one, every 2nd, and so on,
 * whichever is the first that leaves room between the names at the current zoom.
 */
const LABEL_STEPS: Record<ChartRange, readonly number[]> = {
  today: [1, 2, 3, 6, 12],
  week: [1],
  month: [1, 2, 7, 14],
};
/**
 * At least this much room between two names, so they don't run together. Unzoomed, that's
 * every weekday, every 2nd hour, and every 2nd day of Month.
 */
const LABEL_SPACING = 16;

/**
 * Chart Kit's bar chart layout (react-native-chart-kit's v2 bar chart model), mirrored here to
 * work out where its plot starts and how far apart its columns are, so the scale that stays
 * put lines up with the chart that scrolls: the padding around the plot, the gap between the
 * scale's numbers and the plot, the width it reckons for each character of its 11px labels,
 * and its band scale (columns a step apart, a 0.12-step gap in each, a 0.08-step margin at
 * either end).
 */
const KIT = {
  paddingLeft: 10,
  paddingRight: 14,
  labelGap: 8,
  charWidth: 11 * 0.56,
  /** The plot is this many steps wider than its columns: 2 × 0.08 − 0.12. */
  extraSteps: 0.04,
  /** A column's middle, in steps from the start of the plot: 0.08 + 0.88 / 2. */
  centerOffset: 0.52,
};

const textWidth = (text: string) => text.length * KIT.charWidth;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * The app's colors (`colors`) on Chart Kit's iPhone-style ("cupertino") look, with no
 * background. While a column is picked, the numbers and names turn a lighter gray along with
 * the other columns.
 */
const chartTheme = (faded: boolean, colors: ThemeColors) => {
  const labels = faded ? colors.textSubtle : colors.textMuted;
  return {
    background: 'transparent',
    plotBackground: 'transparent',
    grid: colors.border,
    axis: colors.border,
    text: labels,
    mutedText: labels,
    series: [colors.primary],
  };
};

type Column = {
  key: string;
  /** The hour or day: written under the column when there's room, and read out. */
  name: string;
  count: number;
};

/**
 * A clean scale for the tallest column: 2 to 4 steps of 1, 2 or 5 (times 10, 100, ...), so the
 * numbers are whole and round. An empty week still gets a scale, 0 to 2.
 */
function niceScale(max: number): { top: number; step: number } {
  for (let base = 1; ; base *= 10) {
    for (const multiple of [1, 2, 5]) {
      const step = base * multiple;
      const steps = Math.max(2, Math.ceil(max / step));
      if (steps <= 4) return { top: steps * step, step };
    }
  }
}

/**
 * How many todos were written (added) in each column of the range, oldest first: each hour of
 * today, or each of the last 7 or 30 days.
 */
function useTodosWritten(range: ChartRange): Column[] {
  const { todos } = useTodos();
  const { today } = useSelectedDate();

  return useMemo(() => {
    if (range === 'today') {
      const todayKey = toDateKey(today);
      const counts = new Array<number>(HOURS).fill(0);
      for (const todo of todos) {
        const created = new Date(todo.createdAt);
        if (toDateKey(created) === todayKey) counts[created.getHours()] += 1;
      }
      return counts.map((count, hour) => ({ key: `hour-${hour}`, name: formatHour(hour), count }));
    }

    const counts = new Map<DateKey, number>();
    for (const todo of todos) {
      const key = toDateKey(new Date(todo.createdAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const days = range === 'week' ? WEEK_DAYS : MONTH_DAYS;
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i - (days - 1));
      const key = toDateKey(date);
      const name = range === 'week' ? WEEKDAYS[date.getDay()] : formatDayMonth(key);
      return { key, name, count: counts.get(key) ?? 0 };
    });
  }, [todos, today, range]);
}

const renderNothing = () => <G />;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type GrowingColumnProps = {
  x: number;
  width: number;
  /** Where 0 is: the column stands on it. */
  baselineY: number;
  /** Full height, once grown. */
  height: number;
  fill: string;
  opacity: number;
  /** 0 → 1 as the column grows. */
  grow: SharedValue<number>;
};

/**
 * One column, growing up from 0 to its full height as `grow` goes 0 → 1, on the UI thread.
 * Its corners stay round as it grows: SVG keeps the rounding to at most half the height.
 */
function GrowingColumn({ x, width, baselineY, height, fill, opacity, grow }: GrowingColumnProps) {
  const animatedProps = useAnimatedProps(() => {
    const grown = height * grow.get();
    return { y: baselineY - grown, height: grown };
  });

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={Math.min(COLUMN_RADIUS, width / 2)}
      fill={fill}
      fillOpacity={opacity}
      animatedProps={animatedProps}
    />
  );
}

/**
 * How many todos were written over the range (`range`), as columns, drawn with Chart Kit
 * (react-native-chart-kit) in the iPhone style: orange (primary) columns rounded at every
 * corner, with no lines behind them, the counts up the side and the hours or days along the
 * bottom.
 *
 * Columns start out as thick as Week's 7, in every range. Each range opens on now, the current
 * hour or today, as the last column in view (and always named under it). Swipe sideways to
 * scroll through the other hours or days; pinch to zoom in or out, around the spot between
 * your fingers. The scale on the left stays put while the columns scroll. An hour or day with
 * nothing written shows as a gray stub on 0.
 *
 * The columns grow up from 0 each time the chart comes into view: when the Stats tab opens,
 * and when you switch range.
 *
 * Tapping a column picks it: it stays solid while the other columns, the numbers and the
 * names fade lighter. Tapping it again, or anywhere off the columns, puts everything back, and
 * so does switching to another range.
 */
export function TodosWrittenChart({ range }: { range: ChartRange }) {
  const colors = useColors();
  const styles = useStyles();
  const columns = useTodosWritten(range);
  const [width, setWidth] = useState(0);
  // Which column is picked (0 = the oldest), if one is, and in which range: it doesn't carry
  // over to another range.
  const [picked, setPicked] = useState<{ range: ChartRange; index: number } | null>(null);
  const pickedIndex = picked?.range === range ? picked.index : null;
  const theme = useMemo(() => chartTheme(pickedIndex !== null, colors), [pickedIndex, colors]);
  // How far apart the columns are, once pinched; each range starts out unzoomed.
  const [zoom, setZoom] = useState<{ range: ChartRange; step: number } | null>(null);

  const count = columns.length;
  const { top, step: tickStep } = niceScale(Math.max(...columns.map((column) => column.count)));
  // Now's column: the current hour on Today; today itself, the last column, on Week and Month.
  const currentHour = useNow().getHours();
  const currentIndex = range === 'today' ? currentHour : count - 1;

  // Where the plot starts (right of the scale), and the room for columns in the visible width.
  const plotLeft = KIT.paddingLeft + textWidth(String(top)) + KIT.labelGap;
  const plotRoom = Math.max(0, width - plotLeft - KIT.paddingRight);
  /** How far apart the columns are when this many fill the visible width. */
  const stepShowing = (visible: number) => plotRoom / (visible + KIT.extraSteps);
  const defaultStep = stepShowing(Math.min(DEFAULT_VISIBLE_COLUMNS, count));
  const minStep = stepShowing(count);
  const maxStep = stepShowing(Math.min(MIN_VISIBLE_COLUMNS, count));
  const step = clamp(zoom?.range === range ? zoom.step : defaultStep, minStep, maxStep);
  const contentWidthAt = (columnStep: number) =>
    plotLeft + columnStep * (count + KIT.extraSteps) + KIT.paddingRight;

  // The share of each slot a column takes is set by the unzoomed width, so zooming makes the
  // columns themselves thicker or thinner.
  const barWidthRatio =
    defaultStep > 0 ? Math.min(COLUMN_MAX_RATIO, COLUMN_MAX_WIDTH / defaultStep) : COLUMN_MAX_RATIO;

  // The name under a column, or nothing. Counted out from now's column both ways, so the
  // current hour or today is always named.
  const widestName = Math.max(...columns.map((column) => textWidth(column.name)));
  const labelSteps = LABEL_STEPS[range];
  const labelEvery =
    labelSteps.find((every) => every * step >= widestName + LABEL_SPACING) ??
    labelSteps[labelSteps.length - 1];
  const labelFor = (index: number) => {
    const column = columns[index];
    if (!column) return '';
    if ((currentIndex - index) % labelEvery !== 0) return '';
    // A name wider than the room left of its column's middle would run under the scale.
    if (step * (index + KIT.centerOffset) < textWidth(column.name) / 2) return '';
    return column.name;
  };

  // The latest layout, for scrolling and the pinch (their callbacks can outlive a render).
  const layout = useRef({ range, step, minStep, maxStep, plotLeft, width, count, currentIndex });
  useLayoutEffect(() => {
    layout.current = { range, step, minStep, maxStep, plotLeft, width, count, currentIndex };
  });

  // Scrolling. Each range opens with now's column as the last one in view (the hours or days
  // before it to its left), and after a zoom, the chart scrolls to keep the spot between the
  // fingers where it was. Both wait for the chart's new width to be laid out.
  const scrollRef = useRef<ComponentRef<typeof RNScrollView>>(null);
  const scrollX = useRef(0);
  const pendingScroll = useRef<number | 'now' | null>('now');
  useLayoutEffect(() => {
    pendingScroll.current = 'now';
  }, [range]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = event.nativeEvent.contentOffset.x;
  };
  const onContentSizeChange = (contentWidth: number) => {
    const pending = pendingScroll.current;
    pendingScroll.current = null;
    if (pending === null) return;
    const now = layout.current;
    // Now's column at the right edge: where the chart would end if it were the last column.
    const x =
      pending === 'now'
        ? now.plotLeft +
          now.step * (now.currentIndex + 1 + KIT.extraSteps) +
          KIT.paddingRight -
          now.width
        : pending;
    const target = clamp(x, 0, Math.max(0, contentWidth - now.width));
    scrollRef.current?.scrollTo({ x: target, animated: false });
    scrollX.current = target;
  };

  // Pinch to zoom. The spot under the fingers when the pinch starts stays there: each update
  // spaces the columns out or in, then scrolls to put that spot back. Updates with fewer than
  // two fingers down are ignored, so lifting one finger first doesn't throw the chart.
  const pinchStart = useRef({ step: 0, focalX: 0, anchor: 0 });
  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (event) => {
      const now = layout.current;
      pinchStart.current = {
        step: now.step,
        focalX: event.focalX,
        // Where the fingers are, in columns from the start of the plot.
        anchor: (scrollX.current + event.focalX - now.plotLeft) / now.step,
      };
    },
    onUpdate: (event) => {
      if (event.numberOfPointers < 2) return;
      const now = layout.current;
      const start = pinchStart.current;
      const next = clamp(start.step * event.scale, now.minStep, now.maxStep);
      if (Math.abs(next - now.step) < 0.01) return;
      const nextWidth = now.plotLeft + next * (now.count + KIT.extraSteps) + KIT.paddingRight;
      pendingScroll.current = clamp(
        now.plotLeft + start.anchor * next - start.focalX,
        0,
        Math.max(0, nextWidth - now.width),
      );
      setZoom({ range: now.range, step: next });
    },
  });

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // The columns grow in when the chart comes into view: once it's laid out (so they're drawn
  // from the start of the growth), each time the Stats tab is opened, and on a new range.
  const grow = useSharedValue(0);
  const focused = useIsFocused();
  const laidOut = width > 0;
  useEffect(() => {
    if (!focused || !laidOut) return;
    grow.set(0);
    grow.set(withTiming(1, { duration: GROW_DURATION_MS, easing: Easing.out(Easing.cubic) }));
  }, [focused, laidOut, range, grow]);

  // Drawn here rather than by Chart Kit, which fades the other columns by blending them into
  // the background, and there isn't one. Every column stands on 0 and is at least
  // MIN_COLUMN_HEIGHT tall; an empty one is a gray stub.
  const renderColumn = ({ bar }: BarChartRenderBarProps<Column>) => (
    <GrowingColumn
      x={bar.x}
      width={bar.width}
      baselineY={bar.baselineY}
      height={Math.max(bar.height, MIN_COLUMN_HEIGHT)}
      fill={bar.value === 0 ? colors.inkSoft : colors.primary}
      opacity={pickedIndex === null || bar.dataIndex === pickedIndex ? 1 : FADED_OPACITY}
      grow={grow}
    />
  );

  // What the scrolling chart and the scale have in common, so their numbers line up.
  const shared: Omit<BarChartProps<Column>, 'width'> = {
    data: columns,
    xKey: 'key',
    yKey: 'count',
    height: CHART_HEIGHT,
    preset: 'cupertino',
    theme,
    yDomain: [0, top],
    // Intervals, not lines: a step for each one, so they land on the round numbers.
    yTickCount: top / tickStep,
    formatYLabel: (value) => String(Math.round(value)),
    // Every name labelFor gives is drawn; the rest are empty.
    labelStrategy: 'show',
    showHorizontalGridLines: false,
    tooltip: false,
    legend: false,
  };

  return (
    <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
      {width > 0 ? (
        <>
          <GestureDetector gesture={pinch}>
            <ScrollView
              ref={scrollRef}
              horizontal
              // A pinch takes over from scrolling, as on the timeline.
              yieldsToContinuousGestures
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              onContentSizeChange={onContentSizeChange}
            >
              <BarChart
                {...shared}
                width={contentWidthAt(step)}
                // The scale on the left is drawn separately, so it stays put.
                showYAxisLabels={false}
                formatXLabel={(_, index) => labelFor(index)}
                barWidthRatio={barWidthRatio}
                barRadius={COLUMN_RADIUS}
                renderBar={renderColumn}
                interaction={{
                  mode: 'tap',
                  deselectOnOutsidePress: true,
                  // Chart Kit only reports taps; which column looks picked is up to
                  // renderColumn. A column with nothing written is empty, so there's nothing
                  // to pick (its tap area is at the bottom).
                  onSelect: ({ dataIndex }) => {
                    if (columns[dataIndex]?.count === 0) return;
                    setPicked((current) =>
                      current?.range === range && current.index === dataIndex
                        ? null
                        : { range, index: dataIndex },
                    );
                  },
                  onDeselect: () => setPicked(null),
                }}
                // Just the hours or days with something written, so Month isn't 30 numbers long.
                accessibilityLabel={`${RANGE_DESCRIPTIONS[range]}: ${
                  columns
                    .filter((column) => column.count > 0)
                    .map((column) => `${column.name} ${column.count}`)
                    .join(', ') || 'none'
                }`}
              />
            </ScrollView>
          </GestureDetector>

          {/* The scale: the same chart with just its numbers showing, cut off where the plot
              starts. White, so columns scrolling left slide under it. */}
          <View
            style={[styles.scale, { width: plotLeft }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <BarChart {...shared} width={width} formatXLabel={() => ''} renderBar={renderNothing} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  scale: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    pointerEvents: 'none',
  },
}));
