import { colors } from '@/constants/theme';
import type { DueDateKind } from '@/lib/dates';

/**
 * The color of each quick due-date choice: its icon in the due-date sheet, and the matching
 * chip on todos due that day.
 */
export const DUE_DATE_COLORS: Record<
  DueDateKind,
  {
    /** Icon in the due-date sheet. */
    icon: string;
    /** Chip text and icon. */
    text: string;
    /** Chip background. */
    background: string;
  }
> = {
  today: { icon: colors.accent, text: colors.accentDark, background: colors.accentSoft },
  tomorrow: { icon: colors.sun, text: colors.sunDark, background: colors.sunSoft },
  weekend: { icon: colors.sky, text: colors.skyDark, background: colors.skySoft },
  nextWeek: { icon: colors.ink, text: colors.ink, background: colors.inkSoft },
};
