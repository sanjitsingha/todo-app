import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { getHeaderTitle, Header } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import type { NativeStackNavigationOptions } from 'expo-router/native-stack';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackButton } from '@/components/BackButton';
import { CloudSync } from '@/components/CloudSync';
import { createThemedStyles, useColors, useColorSchemeName } from '@/hooks/useTheme';
import { AuthProvider, useAuth } from '@/store/auth';
import { SelectedDateProvider } from '@/store/selectedDate';
import { useSettings } from '@/store/settings';
import { StickiesProvider } from '@/store/stickies';
import { TodosProvider } from '@/store/todos';

// The splash (the logo on white, app.json) stays up until the saved sign-in has been read
// (Screens, below), rather than giving way to a blank page first. Called here, outside any
// component, as Expo recommends, so it's early enough.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or no splash (web): nothing to hold.
});

/** Longest the splash waits for the sign-in, in case reading it never finishes. */
const SPLASH_TIMEOUT_MS = 5000;

export default function RootLayout() {
  const styles = useStyles();

  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hide(), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

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
              <ThemeSync>
                <Screens />
              </ThemeSync>
            </SelectedDateProvider>
          </StickiesProvider>
        </TodosProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Puts the look picked in Appearance (Light, Dark, or the phone's for System) on everything
 * around the screens: the phone's own parts of the app (alerts, the keyboard, sheets), the
 * navigator's colors, the status bar, and the window behind the screens, so nothing flashes
 * white in the dark look while a screen slides in.
 */
function ThemeSync({ children }: { children: ReactNode }) {
  const { appearance } = useSettings();
  const scheme = useColorSchemeName();
  const colors = useColors();

  // Light or Dark overrides the phone's look for the whole app; System hands it back ('auto').
  useEffect(() => {
    Appearance.setColorScheme(appearance === 'system' ? 'auto' : appearance);
  }, [appearance]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      // Only the window behind the screens; they draw their own backgrounds.
    });
  }, [colors.background]);

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.ink,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      {children}
      {/* Dark text on the light look, light text on the dark one. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

/**
 * Signing in is required. Signed out, only the login screens exist; signed in, only the app.
 * Each change moves you over by itself: logging in (or signing up) goes to the Todo tab, and
 * logging out goes to Log in. The one stop between: a forgot password code that checks out
 * signs you in, but you land on the new password screen until it's saved.
 */
function Screens() {
  const styles = useStyles();
  const colors = useColors();

  /**
   * A full page opened on top of the tabs, with a header like Profile's and a back arrow. The
   * header is drawn by the same component as the tabs' headers (src/app/(tabs)/_layout.tsx)
   * rather than the phone's own, which sat at a different height with its title in a different
   * place, so going from Profile to a page shifted the header.
   */
  const pageOptions = (title: string) =>
    ({
      title,
      header: ({ options, route }) => (
        <Header
          title={getHeaderTitle(options, route.name)}
          headerLeft={() => <BackButton />}
          headerRight={options.headerRight}
          headerTitleAlign="left"
          headerTitleStyle={{ fontSize: 22, fontWeight: '700', color: colors.text }}
          headerStyle={{ backgroundColor: colors.pageHeader }}
          headerShadowVisible={false}
        />
      ),
      contentStyle: { backgroundColor: colors.page },
    }) satisfies NativeStackNavigationOptions;
  const { user, ready, resettingPassword } = useAuth();

  // The sign-in is known: the first real screen can show.
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // The saved sign-in is read back in a moment at launch. Until then, a blank page rather than
  // the login screen flashing up for someone who's signed in.
  if (!ready) return <View style={styles.loading} />;

  const signedIn = user !== null;
  return (
    <Stack>
      {/* First, so it's where signing in (or saving a new password) lands. Signed out, these
          send you to Log in: the root stack has no anchor to fall back on, so opening the app
          at / (the Todo tab) showed "Unmatched Route" on a fresh install. */}
      <Stack.Protected guard={signedIn && !resettingPassword} redirectTo="/login">
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
        {/* Opened from Profile's Check for Updates: a page that checks for an over-the-air
            update, shows what's new, and installs it. */}
        <Stack.Screen name="updates" options={pageOptions('Updates')} />
        {/* Opened from the bell in Profile's header (the page draws its own Mark all read). */}
        <Stack.Screen name="notifications" options={pageOptions('Notifications')} />
        {/* Opened from Profile: Avatar, Name, Email, Password, Delete account. */}
        <Stack.Screen name="account" options={pageOptions('Account')} />
        {/* Opened from Profile: Hide completed todos, and Recently deleted. */}
        <Stack.Screen name="general" options={pageOptions('General')} />
        {/* Opened from Profile: Google Calendar's account, Events and Todo sync. */}
        <Stack.Screen name="calendar" options={pageOptions('Calendar')} />
        {/* Opened from Profile: other apps Dooist works with, like the web app's
            Integrations (ChatGPT, coming soon). */}
        <Stack.Screen name="integrations" options={pageOptions('Integrations')} />
        {/* Opened from Profile: a Subject, a message, and Send feedback. */}
        <Stack.Screen name="feedback" options={pageOptions('Feedback')} />
        {/* Opened from Feedback's Subject: what part of the app it's about. Just as tall as
            its options. */}
        <Stack.Screen
          name="feedback-subject"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from Account: changing the name, in a sheet just as tall as its field and
            button. */}
        <Stack.Screen
          name="account-name"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from Account: setting or changing the password, on a page of its own. */}
        <Stack.Screen name="account-password" options={pageOptions('Password')} />
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
        {/* Opened from the Reporting tab's Actions filter: a checkbox for each action. Just
            as tall as its rows. */}
        <Stack.Screen
          name="report-actions"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
          }}
        />
        {/* Opened from the Reporting tab's Date filter: ranges, then a calendar. Starts at
            85% height, like the due-date sheet, which shows it all; drag up for full screen. */}
        <Stack.Screen
          name="report-date"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.85, 1],
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

const useStyles = createThemedStyles((colors) => ({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.page,
  },
}));
