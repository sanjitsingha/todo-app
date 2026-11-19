import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

/**
 * Log in sits at the bottom of these screens (anchored), so it's what signing out, or opening
 * the app signed out, shows; sign up and forgot password open on top of it.
 */
export const unstable_settings = {
  anchor: 'login',
};

/**
 * Log in, sign up and forgot password: the only screens there are until you're signed in
 * (src/app/_layout.tsx). Full screens with no header: each draws its own back arrow, except log
 * in, which has nothing behind it (src/components/auth/AuthScreen.tsx).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
