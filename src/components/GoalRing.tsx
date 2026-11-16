import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

/** Diameter and line width of the ring, in points. */
const SIZE = 32;
const STROKE = 3;
/** Space between chunks along the ring, in points, on top of their rounded ends. */
const CHUNK_GAP = 2;
/** With more todos than this the chunks get too small to tell apart, so it's one smooth ring. */
const MAX_CHUNKS = 10;
/** The fill color goes red, orange, yellow, then green as more of the day is done. */
const PROGRESS_STOPS: readonly string[] = [colors.danger, colors.accent, colors.sun, colors.success];

const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The gap between chunks as an angle, counting the rounded ends that reach into it. */
const GAP_DEGREES = ((CHUNK_GAP + STROKE) / CIRCUMFERENCE) * 360;

function toRgb(hex: string): number[] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The color `amount` (0 to 1) of the way from `from` to `to`. */
function mixColors(from: string, to: string, amount: number): string {
  const end = toRgb(to);
  const channels = toRgb(from).map((channel, i) =>
    Math.round(channel + (end[i] - channel) * amount),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** The fill color for `share` of the day done, 0 to 1: red at the start, green when all done. */
function progressColor(share: number): string {
  const position = Math.min(Math.max(share, 0), 1) * (PROGRESS_STOPS.length - 1);
  const stop = Math.min(Math.floor(position), PROGRESS_STOPS.length - 2);
  return mixColors(PROGRESS_STOPS[stop], PROGRESS_STOPS[stop + 1], position - stop);
}

/** A point on the ring, `degrees` clockwise from the top. */
function pointAt(degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.sin(radians), y: CENTER - RADIUS * Math.cos(radians) };
}

/** The ring from `from` to `to` degrees, clockwise from the top; less than a full turn. */
function arcPath(from: number, to: number): string {
  const start = pointAt(from);
  const end = pointAt(to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

type Props = {
  /** Todos due that day. */
  total: number;
  /** How many of them are done. */
  done: number;
};

/**
 * A day's goal as a ring: one chunk per todo, the day's todo count in the middle. Done todos
 * fill the chunks clockwise from the top, in a color that goes from red when little is done to
 * green when everything is. Past ten todos it's one smooth ring that fills the same way.
 */
export function GoalRing({ total, done }: Props) {
  const color = progressColor(total === 0 ? 0 : done / total);
  const chunked = total >= 2 && total <= MAX_CHUNKS;
  const allDone = total > 0 && done >= total;
  const step = 360 / total;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={total === 0 ? 'No todos' : `${done} of ${total} todos done`}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.ring}>
        {chunked ? (
          Array.from({ length: total }, (_, i) => (
            <Path
              key={i}
              d={arcPath(i * step + GAP_DEGREES / 2, (i + 1) * step - GAP_DEGREES / 2)}
              stroke={i < done ? color : colors.border}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ))
        ) : (
          <>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={allDone ? color : colors.border}
              strokeWidth={STROKE}
              fill="none"
            />
            {done > 0 && !allDone ? (
              <Path
                d={arcPath(0, (done / total) * 360)}
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
          </>
        )}
      </Svg>
      <Text style={styles.count} numberOfLines={1} adjustsFontSizeToFit>
        {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Fits inside the ring, even with three digits.
  count: {
    maxWidth: SIZE - 2 * STROKE - 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
