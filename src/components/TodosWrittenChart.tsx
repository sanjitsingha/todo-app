import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { BarChart, type BarChartRenderBarProps } from 'react-native-chart-kit/v2';
import { Rect } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { WEEKDAYS, addDays, toDateKey, type DateKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos } from '@/store/todos';

/** The days shown: the last week, ending today. */
const DAYS = 7;
const CHART_HEIGHT = 220;
/** Columns are never wider than this; the rest of each day's slot is air. */
const COLUMN_MAX_WIDTH = 24;
/** Every corner is rounded, top and bottom. */
const COLUMN_RADIUS = 4;
/** About how much room the scale's numbers take on the left, for working out column width. */
const Y_AXIS_ALLOWANCE = 32;
/** While a column is picked, the others fade back to this. */
const FADED_OPACITY = 0.3;

/**
 * The app's colors on Chart Kit's iPhone-style ("cupertino") look, with no background. While a
 * column is picked, the numbers and weekdays turn a lighter gray along with the other columns.
 */
const chartTheme = (faded: boolean) => {
  const labels = faded ? colors.textSubtle : colors.textMuted;
  return {
    background: 'transparent',
    plotBackground: 'transparent',
    grid: colors.border,
    axis: colors.border,
    text: labels,
    mutedText: labels,
    series: [colors.ink],
  };
};

type Day = { key: DateKey; weekday: string; count: number };

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

/** How many todos were written (added) on each of the last 7 days, oldest first. */
function useTodosWrittenByDay(): Day[] {
  const { todos } = useTodos();
  const { today } = useSelectedDate();

  return useMemo(() => {
    const counts = new Map<DateKey, number>();
    for (const todo of todos) {
      const key = toDateKey(new Date(todo.createdAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from({ length: DAYS }, (_, i) => {
      const date = addDays(today, i - (DAYS - 1));
      const key = toDateKey(date);
      return { key, weekday: WEEKDAYS[date.getDay()], count: counts.get(key) ?? 0 };
    });
  }, [todos, today]);
}

/**
 * How many todos were written each day this past week, as columns, drawn with Chart Kit
 * (react-native-chart-kit) in the iPhone style: thin columns rounded at every corner, with no
 * lines behind them, the counts up the side and the weekdays along the bottom.
 *
 * Tapping a column picks it: it stays dark while the other columns, the numbers and the
 * weekdays fade lighter. Tapping it again, or anywhere off the columns, puts everything back.
 */
export function TodosWrittenChart() {
  const days = useTodosWrittenByDay();
  const [width, setWidth] = useState(0);
  // Which day's column is picked (0 = the oldest), if one is.
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const theme = useMemo(() => chartTheme(pickedIndex !== null), [pickedIndex]);

  // Drawn here rather than by Chart Kit, which fades the other columns by blending them into
  // the background, and there isn't one.
  const renderColumn = ({ bar, radius }: BarChartRenderBarProps<Day>) => (
    <Rect
      x={bar.x}
      y={bar.y}
      width={bar.width}
      height={bar.height}
      rx={radius}
      fill={colors.ink}
      fillOpacity={pickedIndex === null || bar.dataIndex === pickedIndex ? 1 : FADED_OPACITY}
    />
  );

  const { top, step } = niceScale(Math.max(...days.map((day) => day.count)));
  // Each day's slot is about this wide; the column takes at most COLUMN_MAX_WIDTH of it.
  const slotWidth = (width - Y_AXIS_ALLOWANCE) / DAYS;
  const barWidthRatio = slotWidth > 0 ? Math.min(0.6, COLUMN_MAX_WIDTH / slotWidth) : 0.6;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
      {width > 0 ? (
        <BarChart
          data={days}
          xKey="weekday"
          yKey="count"
          width={width}
          height={CHART_HEIGHT}
          preset="cupertino"
          theme={theme}
          yDomain={[0, top]}
          // Intervals, not lines: a step for each one, so they land on the round numbers.
          yTickCount={top / step}
          formatYLabel={(value) => String(Math.round(value))}
          barWidthRatio={barWidthRatio}
          barRadius={COLUMN_RADIUS}
          showHorizontalGridLines={false}
          renderBar={renderColumn}
          interaction={{
            mode: 'tap',
            deselectOnOutsidePress: true,
            // Chart Kit only reports taps; which column looks picked is up to renderColumn.
            // A day with nothing written has no column to pick (its tap area is at the bottom).
            onSelect: ({ dataIndex }) => {
              if (days[dataIndex]?.count === 0) return;
              setPickedIndex((current) => (current === dataIndex ? null : dataIndex));
            },
            onDeselect: () => setPickedIndex(null),
          }}
          tooltip={false}
          legend={false}
          accessibilityLabel={`Todos written each day, last 7 days: ${days
            .map((day) => `${day.weekday} ${day.count}`)
            .join(', ')}`}
        />
      ) : null}
    </View>
  );
}
