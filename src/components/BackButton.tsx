import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Back arrow for a screen header. Goes back like the system back button, or to the Todo
 * screen when there's nothing to go back to.
 */
export function BackButton() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/');
    }
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={24} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginStart: 8,
    padding: 8,
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});
