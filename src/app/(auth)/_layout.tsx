import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

/**
 * Login, register and forgot password. Full screens with no header: each draws its own back
 * arrow (src/components/auth/AuthScreen.tsx). UI only for now; nothing signs in yet.
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
