import type { ThemeColors } from '@/constants/theme';
import type { DueDateKind } from '@/lib/dates';

/** How one quick due-date choice looks. */
export type DueDateColors = {
  /** Icon in the due-date sheet. */
  icon: string;
  /** Chip text and icon. */
  text: string;
  /** Chip background. */
  background: string;
};

const made = new WeakMap<ThemeColors, Record<DueDateKind, DueDateColors>>();

/**
 * The color of each quick due-date choice, in a look's colors (src/hooks/useTheme.ts,
 * useColors): its icon in the due-date sheet, and the matching chip on todos due that day.
 */
export function dueDateColors(colors: ThemeColors): Record<DueDateKind, DueDateColors> {
  let byKind = made.get(colors);
  if (!byKind) {
    byKind = {
      today: { icon: colors.accent, text: colors.accentDark, background: colors.accentSoft },
      tomorrow: { icon: colors.sun, text: colors.sunDark, background: colors.sunSoft },
      weekend: { icon: colors.sky, text: colors.skyDark, background: colors.skySoft },
      nextWeek: { icon: colors.ink, text: colors.ink, background: colors.inkSoft },
    };
    made.set(colors, byKind);
  }
  return byKind;
}
