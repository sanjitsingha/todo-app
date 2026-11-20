import { Platform, View } from 'react-native';

import { createThemedStyles } from '@/hooks/useTheme';

/**
 * Drag handle for the top of a sheet that can be pulled up. iOS draws its own
 * (`sheetGrabberVisible` in src/app/_layout.tsx), so this only renders on Android.
 */
export function SheetGrabber() {
  const styles = useStyles();
  if (Platform.OS !== 'android') return null;
  return <View style={styles.grabber} />;
}

const useStyles = createThemedStyles((colors) => ({
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    backgroundColor: colors.border,
  },
}));
