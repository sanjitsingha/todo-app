import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { colors } from '@/constants/theme';

/** Distance between dots, across and down, in points. */
const SPACING = 22;
const DOT_RADIUS = 1.3;

/**
 * Dotted paper: an even grid of small gray dots filling its parent, like a whiteboard wall.
 * Drawn once as a repeating pattern, so it costs the same however big the wall is.
 */
export function DotGrid() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" width={SPACING} height={SPACING} patternUnits="userSpaceOnUse">
          <Circle cx={SPACING / 2} cy={SPACING / 2} r={DOT_RADIUS} fill={colors.wallDot} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
}
