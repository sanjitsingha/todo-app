import { Tabs } from 'expo-router';

import { BackButton } from '@/components/BackButton';
import { BottomNavBar } from '@/components/BottomNavBar';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{ sceneStyle: { backgroundColor: colors.background } }}
    >
      {/* The Todo screen draws its own date header (src/components/DateHeader.tsx). */}
      <Tabs.Screen name="index" options={{ title: 'Todo', headerShown: false }} />
      {/* White page with a flat white header, so the header reads as part of the page. */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerLeft: () => <BackButton />,
          headerTitleAlign: 'left',
          headerTitleStyle: { fontSize: 22, fontWeight: '700', color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: colors.surface },
        }}
      />
    </Tabs>
  );
}
