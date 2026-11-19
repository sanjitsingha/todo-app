import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CloudSync } from '@/components/CloudSync';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { SelectedDateProvider } from '@/store/selectedDate';
import { StickiesProvider } from '@/store/stickies';
import { TodosProvider } from '@/store/todos';

export default function RootLayout() {
  return (
    // Needed for gestures from react-native-gesture-handler (swiping between days, the
    // timeline's pinch to zoom, dragging stickies).
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <TodosProvider>
          <StickiesProvider>
            {/* Syncs todos and settings with the signed-in account, and todos on to Google
                Calendar when it's connected. Draws nothing. */}
            <CloudSync />
            <SelectedDateProvider>
              <Screens />
              <StatusBar style="dark" />
            </SelectedDateProvider>
          </StickiesProvider>
        </TodosProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Signing in is required. Signed out, only the login screens exist; signed in, only the app.
 * Each change moves you over by itself: logging in (or signing up) goes to the Todo tab, and
 * logging out goes to Log in. The one stop between: a forgot password code that checks out
 * signs you in, but you land on the new password screen until it's saved.
 */
function Screens() {
  const { user, ready, resettingPassword } = useAuth();

  // The saved sign-in is read back in a moment at launch. Until then, a blank page rather than
  // the login screen flashing up for someone who's signed in.
  if (!ready) return <View style={styles.loading} />;

  const signedIn = user !== null;
  return (
    <Stack>
      {/* First, so it's where signing in (or saving a new password) lands. */}
      <Stack.Protected guard={signedIn && !resettingPassword}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Starts at 60% height, which fits the whole form down to the Add button (half
            height cut it off once the Duration row came in); drag up for full screen. */}
        <Stack.Screen
          name="add"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from the add sheet or a todo's details, on top of it. Starts at 85%
            height, which shows the whole calendar and the Add time button; drag up for
            full screen. */}
        <Stack.Screen
          name="due-date"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from the Reminder row of the add sheet or a todo's details, on top of
            it: a time picker. Starts tall enough for the picker and its button; drag up
            for full screen. */}
        <Stack.Screen
          name="reminder"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from the Duration row of the add sheet, on top of it: hours and minutes
            strips. The same size as the reminder sheet; drag up for full screen. */}
        <Stack.Screen
          name="duration"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from Profile: Vibrate, Tick, Tick with Vibration or None. Just as tall
            as its options. */}
        <Stack.Screen
          name="haptic-feedback"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from Profile: Light, Dark or System. Just as tall as its options. */}
        <Stack.Screen
          name="appearance"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* A todo's details, opened by tapping it in the list. Starts at half height;
            drag up for full screen (for a long description). */}
        <Stack.Screen
          name="todo/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
      </Stack.Protected>

      {/* Log in, sign up and forgot password. Log in is where signing out lands. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* The last step of forgot password: the code has signed you in, and this is the only
          screen until the new password is saved (or the app is closed). */}
      <Stack.Protected guard={signedIn && resettingPassword}>
        <Stack.Screen name="new-password" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
