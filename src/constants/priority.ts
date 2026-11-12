import { colors } from '@/constants/theme';
import type { Priority } from '@/store/todos';

/** The priority levels, highest first, with how each one looks. */
export const PRIORITIES: readonly {
  value: Priority;
  label: string;
  /** Text and icon color. */
  color: string;
  /** Tinted background behind the label when it's picked. */
  background: string;
}[] = [
  { value: 'high', label: 'High', color: colors.danger, background: colors.dangerSoft },
  { value: 'medium', label: 'Medium', color: colors.amberDark, background: colors.amberSoft },
  { value: 'low', label: 'Low', color: colors.skyDark, background: colors.skySoft },
];
