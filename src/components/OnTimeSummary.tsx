import { useIsFocused } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { ChartRange } from '@/components/TodosWrittenChart';
import type { ThemeColors } from '@/constants/theme';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useNow } from '@/hooks/useNow';
import { addDays, deadlineOf, toDateKey, type DateKey } from '@/lib/dates';
import { useTodos } from '@/store/todos';

/** How a todo turned out: done by its deadline, done after it, or not done and past it. */
type Outcome = 'onTime' | 'late' | 'overdue';
type Counts = Record<Outcome, number>;

/** Clockwise from the top of the ring, and down the list beside it. */
const OUTCOMES: readonly {
  key: Outcome;
  label: string;
  /** Its part of the ring, and the dot by its name: a theme color's name. */
  ring: keyof ThemeColors;
  /** Its count: a deeper shade where the ring color is too light for text. */
  text: keyof ThemeColors;
}[] = [
  { key: 'onTime', label: 'On time', ring: 'success', text: 'successDark' },
  { key: 'late', label: 'Late', ring: 'accent', text: 'accentDark' },
  { key: 'overdue', label: 'Overdue', ring: 'danger', text: 'danger' },
];

/** Days each range covers, ending today. */
const RANGE_DAYS: Record<ChartRange, number> = { today: 1, week: 7, month: 30 };
/** For screen readers. */
const RANGE_PHRASES: Record<ChartRange, string> = {
  today: 'today',
  week: 'in the last 7 days',
  month: 'in the last 30 days',
};

/** Diameter and line width of the ring, in points. */
const SIZE = 136;
const STROKE = 16;
/** White space between the ring's parts, in points, on top of their rounded ends. */
const SEGMENT_GAP = 4;
/** How long the ring takes to sweep round when it comes into view. */
const SWEEP_DURATION_MS = 900;

const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The gap between parts as an angle, counting the rounded ends that reach into it. */
const GAP_DEGREES = ((SEGMENT_GAP + STROKE) / CIRCUMFERENCE) * 360;
/** No part takes less of the ring than this, so even one todo out of many shows, as a dot. */
const MIN_SWEEP = GAP_DEGREES + 1;
/** Long enough for a rounded line end to draw, so a part that's just a dot still shows. */
const DOT_DEGREES = 0.01;

/** The numbers are in iPhone's rounded system font; elsewhere, the usual one. */
const ROUNDED_FONT = Platform.select({ ios: 'ui-rounded', default: undefined });

/**
 * How the todos settled in the range turned out. Done before its deadline (deadlineOf), even
 * days early, a todo is on time; done after it, late; not done with the deadline gone, overdue.
 * It counts on the day it settled: the day it was marked done, or, if it's still not done, the
 * day its deadline passed. Todos not done whose deadline is still ahead haven't settled, so
 * they don't count yet.
 */
function useOutcomes(range: ChartRange): Counts {
  const { todos } = useTodos();
  const now = useNow();

  return useMemo(() => {
    const counts: Counts = { onTime: 0, late: 0, overdue: 0 };
    const last = toDateKey(now);
    const first = toDateKey(addDays(now, 1 - RANGE_DAYS[range]));

    for (const todo of todos) {
      const deadline = deadlineOf(todo);
      let outcome: Outcome;
      let settled: DateKey;
      if (todo.completed) {
        // Every done todo has a finish time (the store fills one in for old ones).
        const completedAt = todo.completedAt ?? deadline - 1;
        outcome = completedAt < deadline ? 'onTime' : 'late';
        settled = toDateKey(new Date(completedAt));
      } else {
        if (now.getTime() < deadline) continue;
        outcome = 'overdue';
        settled = toDateKey(new Date(deadline - 1));
      }
      if (settled >= first && settled <= last) counts[outcome] += 1;
    }
    return counts;
  }, [todos, now, range]);
}

const totalOf = (counts: Counts) => counts.onTime + counts.late + counts.overdue;

/**
 * The share done on time, as a whole percent, or null with nothing to go on. It never rounds
 * up to 100 while one wasn't on time, nor down to 0 while one was.
 */
function onTimePercent(counts: Counts): number | null {
  const total = totalOf(counts);
  if (total === 0) return null;
  if (counts.onTime === total) return 100;
  if (counts.onTime === 0) return 0;
  return Math.min(Math.max(Math.round((counts.onTime / total) * 100), 1), 99);
}

/** One part of the ring, in degrees clockwise from the top. */
type Arc = { key: Outcome; from: number; to: number; color: string };

/**
 * The ring's parts, clockwise from the top: one for each outcome with any todos, sized by its
 * share. One outcome alone is the whole ring. Otherwise there's a gap between parts, and a
 * very small part is made big enough to show, taking the room from the bigger ones. Colored
 * from `colors`.
 */
function ringArcs(counts: Counts, colors: ThemeColors): Arc[] {
  const total = totalOf(counts);
  const present = OUTCOMES.filter((outcome) => counts[outcome.key] > 0);
  if (present.length === 0) return [];
  if (present.length === 1) {
    return [{ key: present[0].key, from: 0, to: 360, color: colors[present[0].ring] }];
  }

  const shares = present.map((outcome) => (counts[outcome.key] / total) * 360);
  const shortfall = shares.reduce((sum, share) => sum + Math.max(0, MIN_SWEEP - share), 0);
  const roomy = shares.reduce((sum, share) => (share >= MIN_SWEEP ? sum + share : sum), 0);
  const sweeps = shares.map((share) =>
    share < MIN_SWEEP ? MIN_SWEEP : share - shortfall * (share / roomy),
  );

  let start = 0;
  return present.map((outcome, i) => {
    const sweep = sweeps[i];
    const middle = start + sweep / 2;
    // Half the part's length once its share of the gaps is taken off (at least nothing: a dot).
    const half = Math.max(0, (sweep - GAP_DEGREES) / 2);
    start += sweep;
    return {
      key: outcome.key,
      from: middle - half,
      to: middle + half,
      color: colors[outcome.ring],
    };
  });
}

/** A point on the ring, `degrees` clockwise from the top. */
function pointAt(degrees: number): { x: number; y: number } {
  'worklet';
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.sin(radians), y: CENTER - RADIUS * Math.cos(radians) };
}

/**
 * The ring from `from` to `to` degrees, clockwise from the top, up to a full turn. Drawn as two
 * halves, since a single arc can't go all the way round.
 */
function arcPath(from: number, to: number): string {
  'worklet';
  const start = pointAt(from);
  const middle = pointAt((from + to) / 2);
  const end = pointAt(to);
  return (
    `M ${start.x} ${start.y} ` +
    `A ${RADIUS} ${RADIUS} 0 0 1 ${middle.x} ${middle.y} ` +
    `A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * One part of the ring, drawn as far round as the sweep has got (`sweep` 0 → 1 is a full turn),
 * on the UI thread. It shows as a dot when the sweep reaches it, then grows to its full length.
 */
function RingArc({ from, to, color, sweep }: Omit<Arc, 'key'> & { sweep: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const head = sweep.get() * 360;
    if (head <= from) return { d: arcPath(from, from + DOT_DEGREES), strokeOpacity: 0 };
    return { d: arcPath(from, Math.max(Math.min(head, to), from + DOT_DEGREES)), strokeOpacity: 1 };
  });

  return (
    <AnimatedPath
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

/**
 * How many of the todos settled in the range (`range`) were done on time, as a ring: green for
 * on time, orange for late, red for overdue, with the share on time in the middle and the
 * counts beside it.
 *
 * The ring sweeps round from the top each time it comes into view: when the Stats tab opens,
 * and when you switch range.
 */
export function OnTimeSummary({ range }: { range: ChartRange }) {
  const colors = useColors();
  const styles = useStyles();
  const counts = useOutcomes(range);
  const total = totalOf(counts);
  const percent = onTimePercent(counts);
  const arcs = useMemo(() => ringArcs(counts, colors), [counts, colors]);

  const sweep = useSharedValue(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    sweep.set(0);
    sweep.set(withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.out(Easing.cubic) }));
  }, [focused, range, sweep]);

  const phrase = RANGE_PHRASES[range];
  const accessibilityLabel =
    total === 0
      ? `On time ${phrase}: nothing done or due yet.`
      : `On time ${phrase}: ${percent} percent. ` +
        `${counts.onTime} on time, ${counts.late} late, ${counts.overdue} overdue.`;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        <View style={styles.ring}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.ringSvg}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={colors.inputBackground}
              strokeWidth={STROKE}
              fill="none"
            />
            {arcs.map(({ key, ...arc }) => (
              <RingArc key={key} {...arc} sweep={sweep} />
            ))}
          </Svg>
          {percent === null ? (
            <Text style={[styles.percent, styles.percentEmpty]}>–</Text>
          ) : (
            <Text style={styles.percent}>
              {percent}
              <Text style={styles.percentSign}>%</Text>
            </Text>
          )}
          <Text style={styles.ringLabel}>on time</Text>
        </View>

        <View style={styles.legend}>
          {OUTCOMES.map((outcome) => {
            const count = counts[outcome.key];
            return (
              <View key={outcome.key}>
                <View style={styles.legendName}>
                  <View style={[styles.dot, { backgroundColor: colors[outcome.ring] }]} />
                  <Text style={styles.legendLabel}>{outcome.label}</Text>
                </View>
                <Text
                  style={[
                    styles.legendCount,
                    { color: count > 0 ? colors[outcome.text] : colors.textSubtle },
                  ]}
                >
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const DOT_SIZE = 8;
const DOT_GAP = 6;

const useStyles = createThemedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  percent: {
    fontFamily: ROUNDED_FONT,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    color: colors.text,
  },
  percentEmpty: {
    color: colors.textSubtle,
  },
  percentSign: {
    fontSize: 20,
    letterSpacing: 0,
  },
  ringLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  legend: {
    flex: 1,
    gap: 6,
  },
  legendName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // Lined up under its name, past the dot.
  legendCount: {
    marginLeft: DOT_SIZE + DOT_GAP,
    fontFamily: ROUNDED_FONT,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
}));
