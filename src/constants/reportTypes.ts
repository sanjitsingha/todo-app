// Just these icons, not the whole icon set.
import Check from 'lucide-react-native/icons/check';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Undo2 from 'lucide-react-native/icons/undo-2';
import type { ComponentType } from 'react';

import type { ThemeColors } from '@/constants/theme';
import type { ReportType } from '@/lib/activity';

export type ReportTypeInfo = {
  value: ReportType;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** The badge's fill, and its icon on top: names of theme colors, so they follow the look. */
  color: keyof ThemeColors;
  onColor: keyof ThemeColors;
};

/**
 * Each action on the Reporting tab: its name, icon and badge colors, shared by the filter, the
 * log and the PDF. The same as the web app's: done is the Dooist orange.
 */
export const REPORT_TYPES: readonly ReportTypeInfo[] = [
  { value: 'added', label: 'Added Todos', icon: Plus, color: 'success', onColor: 'onStatus' },
  {
    value: 'updated',
    label: 'Updated Todos',
    icon: Pencil,
    color: 'skyDark',
    onColor: 'onStatus',
  },
  {
    value: 'completed',
    label: 'Completed Todos',
    icon: Check,
    color: 'primary',
    onColor: 'onPrimary',
  },
  {
    value: 'uncompleted',
    label: 'Uncompleted Todos',
    icon: Undo2,
    color: 'amberDark',
    onColor: 'onStatus',
  },
  { value: 'deleted', label: 'Deleted Todos', icon: Trash2, color: 'danger', onColor: 'onStatus' },
];

export function reportTypeInfo(type: ReportType): ReportTypeInfo {
  return REPORT_TYPES.find(({ value }) => value === type) ?? REPORT_TYPES[0];
}

/** True when nothing is ticked, or everything is: either way, every action shows. */
export function isEveryType(types: readonly ReportType[]): boolean {
  return types.length === 0 || types.length === REPORT_TYPES.length;
}

/** "All Actions", one action's name, or e.g. "2 selected". */
export function actionsSummary(types: readonly ReportType[]): string {
  if (isEveryType(types)) return 'All Actions';
  if (types.length === 1) return reportTypeInfo(types[0]).label;
  return `${types.length} selected`;
}
