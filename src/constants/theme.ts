export const colors = {
  // Soft yellow. Too light for text or icons on white, so it's only used as a fill
  // (buttons, checked boxes, the picked day), always with dark content on top.
  primary: '#F6DB72',
  primaryPressed: '#ECCB4F',
  onPrimary: '#1F2937',
  /** Charcoal, a step short of black: for emphasized text and icons on white. */
  ink: '#1F2937',
  /** Text on an `ink` fill, like the picked day in the date strip. */
  onInk: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  inputBackground: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  iconInactive: '#94A3B8',
  danger: '#DC2626',
  /** Green for "all done", like the full goal ring. */
  success: '#16A34A',
  /** Tinted backgrounds and their text colors, used for the priority options and date chips. */
  dangerSoft: '#FEE2E2',
  amberSoft: '#FEF3C7',
  amberDark: '#B45309',
  skySoft: '#E0F2FE',
  skyDark: '#0369A1',
  /** Deep shades of the soft backgrounds above, for text that sits on them. */
  dangerDeep: '#991B1B',
  amberDeep: '#92400E',
  skyDeep: '#075985',
  sunSoft: '#FEF9C3',
  sunDark: '#A16207',
  inkSoft: '#E5E7EB',
  accent: '#F97316',
  /** Tinted chip background and its icon/text color, used for "due today". */
  accentSoft: '#FFEDD5',
  accentDark: '#C2410C',
  ripple: 'rgba(31, 41, 55, 0.12)',
  /** Icon colors for the quick due-date choices ("Today" uses `accent`, "Next week" `ink`). */
  sun: '#EAB308',
  sky: '#0EA5E9',
} as const;
