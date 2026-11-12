import { Tabs } from 'expo-router';

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
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
