import { Platform, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Drag handle for the top of a sheet that can be pulled up. iOS draws its own
 * (`sheetGrabberVisible` in src/app/_layout.tsx), so this only renders on Android.
 */
export function SheetGrabber() {
  if (Platform.OS !== 'android') return null;
  return <View style={styles.grabber} />;
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    backgroundColor: colors.border,
  },
});
