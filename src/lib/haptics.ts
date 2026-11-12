import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A firm "click", for each step of a swipeable strip (days, hours, minutes). */
export function tick() {
  if (Platform.OS === 'android') {
    // Virtual_Key is the crisp click of the system nav buttons: clearly stronger than the
    // tick types, works on every Android version, and follows the phone's touch-feedback setting.
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}
