import type { ThemeColors } from '@/constants/theme';
import type { Priority } from '@/store/todos';

/** A priority level and how it looks. */
export type PriorityLevel = {
  value: Priority;
  label: string;
  /** Text and icon color. */
  color: string;
  /** Tinted background behind the label when it's picked. */
  background: string;
  /** A deep shade of `background`, for text on it, like a todo's title on the timeline. */
  deep: string;
};

const made = new WeakMap<ThemeColors, readonly PriorityLevel[]>();

/** The priority levels, highest first, in a look's colors (src/hooks/useTheme.ts, useColors). */
export function priorityLevels(colors: ThemeColors): readonly PriorityLevel[] {
  let levels = made.get(colors);
  if (!levels) {
    levels = [
      {
        value: 'high',
        label: 'High',
        color: colors.danger,
        background: colors.dangerSoft,
        deep: colors.dangerDeep,
      },
      {
        value: 'medium',
        label: 'Medium',
        color: colors.amberDark,
        background: colors.amberSoft,
        deep: colors.amberDeep,
      },
      {
        value: 'low',
        label: 'Low',
        color: colors.skyDark,
        background: colors.skySoft,
        deep: colors.skyDeep,
      },
    ];
    made.set(colors, levels);
  }
  return levels;
}
