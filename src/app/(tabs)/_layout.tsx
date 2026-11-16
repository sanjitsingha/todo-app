import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect } from 'react';

import { BackButton } from '@/components/BackButton';
import { BottomNavBar } from '@/components/BottomNavBar';
import { colors } from '@/constants/theme';
import { useSelectedDate } from '@/store/selectedDate';

/**
 * The bottom navbar, plus a rule for the tabs as a whole: going to another tab (Stats, Profile)
 * puts the date strip back on today, so the Todo tab always comes back to today. Sheets opened
 * on top of the Todo tab (add, todo details) aren't tabs, so they keep the day you were on.
 * It's done on the way out, so the strip is already on today when the Todo tab shows again.
 */
function TabBar(props: BottomTabBarProps) {
  const { selectDate, todayKey } = useSelectedDate();
  const activeTab = props.state.routes[props.state.index]?.name;

  useEffect(() => {
    if (activeTab !== 'index') selectDate(todayKey);
  }, [activeTab, selectDate, todayKey]);

  return <BottomNavBar {...props} />;
}

/** White page with a flat white header, so the header reads as part of the page. */
const PAGE_OPTIONS = {
  headerLeft: () => <BackButton />,
  headerTitleAlign: 'left',
  headerTitleStyle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  sceneStyle: { backgroundColor: colors.surface },
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ sceneStyle: { backgroundColor: colors.background } }}
    >
      {/* The Todo screen draws its own date header (src/components/DateHeader.tsx). */}
      <Tabs.Screen name="index" options={{ title: 'Today', headerShown: false }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', ...PAGE_OPTIONS }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', ...PAGE_OPTIONS }} />
    </Tabs>
  );
}
