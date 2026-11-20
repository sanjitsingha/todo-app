import { StyleSheet, useColorScheme } from 'react-native';

import { themeColors, type ColorScheme, type ThemeColors } from '@/constants/theme';
import { useSettings } from '@/store/settings';

/**
 * The look showing now: the Appearance setting's Light or Dark, or the phone's own look for
 * System. Re-renders when either changes.
 */
export function useColorSchemeName(): ColorScheme {
  const { appearance } = useSettings();
  // The phone's look. With Light or Dark picked, the app overrides it (ThemeSync in
  // src/app/_layout.tsx), so it's only read for System, once the override is gone.
  const phone = useColorScheme();
  if (appearance !== 'system') return appearance;
  return phone === 'dark' ? 'dark' : 'light';
}

/** The colors of the look showing now (src/constants/theme.ts). */
export function useColors(): ThemeColors {
  return themeColors[useColorSchemeName()];
}

/** What `StyleSheet.create` takes: named styles. */
type StyleDefinitions = Parameters<typeof StyleSheet.create>[0];

/**
 * Styles that use the theme's colors: `build` makes them from a look's colors, once per look,
 * and the hook it gives back returns the ones for the look showing now. In place of
 * `StyleSheet.create` at the bottom of a file:
 *
 *   const useStyles = createThemedStyles((colors) => ({ page: { backgroundColor: colors.surface } }));
 *
 * and in the component, `const styles = useStyles();`.
 */
export function createThemedStyles<S extends StyleDefinitions>(
  build: (colors: ThemeColors) => S & StyleDefinitions,
): () => Readonly<S> {
  const made: Partial<Record<ColorScheme, Readonly<S>>> = {};
  return function useThemedStyles(): Readonly<S> {
    const scheme = useColorSchemeName();
    return (made[scheme] ??= StyleSheet.create(build(themeColors[scheme])));
  };
}
