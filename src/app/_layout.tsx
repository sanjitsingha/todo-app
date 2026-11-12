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
          <Stack.Screen
            name="add"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: 'fitToContents',
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
