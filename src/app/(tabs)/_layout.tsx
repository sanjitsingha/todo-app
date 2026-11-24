import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useMemo } from 'react';

import { BackButton } from '@/components/BackButton';
import { BottomNavBar } from '@/components/BottomNavBar';
import { NotificationBell } from '@/components/NotificationBell';
import type { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/useTheme';
import { useSelectedDate } from '@/store/selectedDate';

/**
 * The bottom navbar, plus a rule for the tabs as a whole: going to another tab (Upcoming,
 * Reporting, Sticky, Profile) puts the date strip back on today, so the Todo tab always comes back to today.
 * Sheets opened on top of the Todo tab (add, todo details) aren't tabs, so they keep the day
 * you were on. It's done on the way out, so the strip is already on today when the Todo tab
 * shows again.
 */
function TabBar(props: BottomTabBarProps) {
  const { selectDate, todayKey } = useSelectedDate();
  const activeTab = props.state.routes[props.state.index]?.name;

  useEffect(() => {
    if (activeTab !== 'index') selectDate(todayKey);
  }, [activeTab, selectDate, todayKey]);

  return <BottomNavBar {...props} />;
}

/**
 * Options for a page in `colors`, with a flat header. `gray` is a gray page (the light gray
 * behind the Todo tab's date strip) rather than a white one. In the light look the header is
 * the page's own color, so it reads as part of the page; in the dark look every page is the
 * darkest gray and its header a step lighter.
 */
function pageOptions(colors: ThemeColors, gray = false) {
  const backgroundColor = gray ? colors.background : colors.page;
  const headerColor = gray ? colors.headerBackground : colors.pageHeader;
  return {
    headerLeft: () => <BackButton />,
    headerTitleAlign: 'left',
    headerTitleStyle: { fontSize: 22, fontWeight: '700', color: colors.text },
    headerStyle: { backgroundColor: headerColor },
    headerShadowVisible: false,
    sceneStyle: { backgroundColor },
  } as const;
}

export default function TabsLayout() {
  const colors = useColors();
  const page = useMemo(() => pageOptions(colors), [colors]);
  const grayPage = useMemo(() => pageOptions(colors, true), [colors]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ sceneStyle: { backgroundColor: colors.background } }}
    >
      {/* The Todo screen draws its own date header (src/components/DateHeader.tsx). */}
      <Tabs.Screen name="index" options={{ title: 'Today', headerShown: false }} />
      {/* Every open todo due after today, by day, as on the web app, on a white page. */}
      <Tabs.Screen name="upcoming" options={{ title: 'Upcoming', ...page }} />
      {/* A log of what happened to your todos, as on the web app, on a white page. */}
      <Tabs.Screen name="reporting" options={{ title: 'Reporting', ...page }} />
      {/* A dotted wall of sticky notes, on the same light gray. Hidden for now: no tab in the
          bar until FEATURES.sticky is turned on. */}
      <Tabs.Screen name="sticky" options={{ title: 'Sticky', ...grayPage }} />
      {/* With the bell for the Notifications page at the right of its header. */}
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', ...page, headerRight: () => <NotificationBell /> }}
      />
    </Tabs>
  );
}
