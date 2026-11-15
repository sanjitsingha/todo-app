import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SelectedDateProvider } from '@/store/selectedDate';
import { TodosProvider } from '@/store/todos';

export default function RootLayout() {
  return (
    // Needed for gestures from react-native-gesture-handler (the timeline's pinch to zoom).
    <GestureHandlerRootView style={styles.root}>
      <TodosProvider>
        <SelectedDateProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Login, register and forgot password, opened from Settings. */}
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            {/* Starts at half height; drag up for full screen. */}
            <Stack.Screen
              name="add"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.5, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                headerShown: false,
              }}
            />
            {/* Opened from the add sheet or a todo's details, on top of it. Starts at 85% height,
                which shows the whole calendar and the Add time button; drag up for full screen. */}
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
            {/* Opened from the Reminder row of the add sheet or a todo's details, on top of it: a
                time picker. Starts tall enough for the picker and its button; drag up for full
                screen. */}
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
            {/* A todo's details, opened by tapping it in the list. Starts at half height; drag up
                for full screen (for a long description). */}
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
          </Stack>
          <StatusBar style="dark" />
        </SelectedDateProvider>
      </TodosProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
