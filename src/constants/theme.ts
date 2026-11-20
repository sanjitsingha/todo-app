/** The two looks the app has. Which one shows comes from the Appearance setting (src/hooks/useTheme.ts). */
export type ColorScheme = 'light' | 'dark';

const light = {
  // The Dooist orange, from the logo, in both looks: buttons, checked boxes, the chart's
  // columns, the top of the login screens. White content on top, like the logo.
  primary: '#FC5C2C',
  primaryPressed: '#E2481B',
  onPrimary: '#FFFFFF',
  /** Charcoal, a step short of black: for emphasized text and icons on white. */
  ink: '#1F2937',
  /** Text on an `ink` fill, like the picked day in the date strip. */
  onInk: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  inputBackground: '#F1F5F9',
  /** A full page that's white in this look: Profile, Log in and Sign up. */
  page: '#FFFFFF',
  /** The header bar of such a page. */
  pageHeader: '#FFFFFF',
  /**
   * The header of a gray page: the Todo screen's date header and strip (and the status bar
   * above them), and Stats.
   */
  headerBackground: '#F8FAFC',
  /** Behind the day's todos, below the date strip. */
  listBackground: '#FFFFFF',
  /** A finished todo's card in the list (open ones are tinted by priority). */
  card: '#F8FAFC',
  border: '#E2E8F0',
  /** A line between groups of rows, like above Delete account. */
  divider: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  iconInactive: '#94A3B8',
  danger: '#DC2626',
  /** Green for "all done", like the full goal ring. */
  success: '#16A34A',
  /** A deeper green, for text: the On time count on the Stats tab. */
  successDark: '#15803D',
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
  /**
   * Icon colors for the due-date kinds (src/constants/dueDate.ts): `sun` for tomorrow, `sky` for
   * this weekend ("Today" uses `accent`, "Next week" `ink`).
   */
  sun: '#EAB308',
  sky: '#0EA5E9',
  /**
   * Sticky note colors on the Sticky tab (src/constants/sticky.ts). Pale, like paper notes, in
   * both looks, so the text on them (`stickyInk`) is always dark.
   */
  stickyYellow: '#FDE68A',
  stickyPink: '#FBCFE8',
  stickyBlue: '#BFDBFE',
  stickyGreen: '#BBF7D0',
  stickyPurple: '#DDD6FE',
  stickyOrange: '#FED7AA',
  /** Text and the cursor on a sticky note. */
  stickyInk: '#1F2937',
  /** The dots on the Sticky tab's wall. */
  wallDot: '#CBD5E1',
  /** Behind a sticky being written, so the wall fades back. */
  wallVeil: 'rgba(248, 250, 252, 0.88)',
  /** Shadows under raised things (stickies). */
  shadow: '#0F172A',
};

/** Every color the app draws with, by what it's for. Both looks have the same names. */
export type ThemeColors = { readonly [Name in keyof typeof light]: string };

export const lightColors: ThemeColors = light;

/**
 * The dark look, built on three neutral grays, each name keeping its job:
 * - `#0E0E10`, the darkest: every page (`background`, `page`, `listBackground`).
 * - `#151515`, a step up: headers, the navbar, cards, sheets (`surface`, `pageHeader`,
 *   `headerBackground`, `card`).
 * - `#28282B`, a step up again: inputs, borders, gray chips (`inputBackground`, `border`,
 *   `inkSoft`).
 * Text is near white with neutral grays below it. The Dooist orange (`primary`) and the sticky
 * notes stay as they are in the light look, content and all; tinted chips become dark tints,
 * with light text on them.
 */
export const darkColors: ThemeColors = {
  primary: '#FC5C2C',
  primaryPressed: '#E2481B',
  onPrimary: '#FFFFFF',
  ink: '#F4F4F5',
  onInk: '#0E0E10',
  background: '#0E0E10',
  surface: '#151515',
  inputBackground: '#28282B',
  // Every page on the darkest, and every header a step up from it, on the mid gray (like the
  // navbar), so headers don't run into the todos and timeline below them.
  page: '#0E0E10',
  pageHeader: '#151515',
  headerBackground: '#151515',
  listBackground: '#0E0E10',
  // A step up from the page, so finished todos still show.
  card: '#151515',
  border: '#28282B',
  // The mid gray: a line just lighter than the page.
  divider: '#151515',
  text: '#F4F4F5',
  textMuted: '#A1A1AA',
  textSubtle: '#71717A',
  iconInactive: '#71717A',
  danger: '#F87171',
  success: '#22C55E',
  successDark: '#4ADE80',
  dangerSoft: '#3A1D24',
  amberSoft: '#3A2C12',
  amberDark: '#FBBF24',
  skySoft: '#0F2A3D',
  skyDark: '#38BDF8',
  dangerDeep: '#FCA5A5',
  amberDeep: '#FCD34D',
  skyDeep: '#7DD3FC',
  sunSoft: '#373113',
  sunDark: '#FACC15',
  inkSoft: '#28282B',
  accent: '#FB923C',
  accentSoft: '#3D2616',
  accentDark: '#FDBA74',
  ripple: 'rgba(244, 244, 245, 0.12)',
  sun: '#FACC15',
  sky: '#38BDF8',
  stickyYellow: '#FDE68A',
  stickyPink: '#FBCFE8',
  stickyBlue: '#BFDBFE',
  stickyGreen: '#BBF7D0',
  stickyPurple: '#DDD6FE',
  stickyOrange: '#FED7AA',
  stickyInk: '#1F2937',
  wallDot: '#28282B',
  wallVeil: 'rgba(14, 14, 16, 0.88)',
  shadow: '#000000',
};

export const themeColors: Readonly<Record<ColorScheme, ThemeColors>> = {
  light: lightColors,
  dark: darkColors,
};
