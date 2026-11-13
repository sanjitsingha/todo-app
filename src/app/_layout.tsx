import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SelectedDateProvider } from '@/store/selectedDate';
import { TodosProvider } from '@/store/todos';

export default function RootLayout() {
  return (
    <TodosProvider>
      <SelectedDateProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
          {/* Opened from the add sheet, on top of it. Starts at 85% height, which shows the whole
              calendar and the Add time button; drag up for full screen. */}
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
          {/* Opened from the add sheet's Reminder row, on top of it: a time picker. Starts tall
              enough for the picker and its button; drag up for full screen. */}
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
  );
}
