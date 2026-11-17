import { colors } from '@/constants/theme';
import type { StickyColor } from '@/store/stickies';

/** The colors a sticky can be, in the order the editor offers them. Yellow is the default. */
export const STICKY_COLORS: readonly { value: StickyColor; label: string; fill: string }[] = [
  { value: 'yellow', label: 'Yellow', fill: colors.stickyYellow },
  { value: 'pink', label: 'Pink', fill: colors.stickyPink },
  { value: 'blue', label: 'Blue', fill: colors.stickyBlue },
  { value: 'green', label: 'Green', fill: colors.stickyGreen },
  { value: 'purple', label: 'Purple', fill: colors.stickyPurple },
  { value: 'orange', label: 'Orange', fill: colors.stickyOrange },
];

export function stickyFill(color: StickyColor): string {
  return STICKY_COLORS.find((option) => option.value === color)?.fill ?? colors.stickyYellow;
}

/**
 * A sticky on the wall: a square this many points across, its text inset by STICKY_PADDING.
 * The editor draws the same sticky bigger, everything scaled up alike, so the text wraps the
 * same way and the sticky can grow out of the wall and shrink back into it without a jump.
 */
export const STICKY_SIZE = 144;
export const STICKY_PADDING = 14;
export const STICKY_FONT_SIZE = 15;
export const STICKY_LINE_HEIGHT = 20;
/** Lines of text that fit on a sticky on the wall; past that it ends in "…". */
export const STICKY_MAX_LINES = 5;
export const STICKY_RADIUS = 6;
/** Room left between stickies when a new one is put up. */
export const STICKY_GAP = 16;
/** Most a sticky leans either way, in degrees, so the wall looks stuck up by hand. */
export const STICKY_MAX_TILT = 3;
/** How much a sticky can hold. */
export const STICKY_MAX_LENGTH = 200;
