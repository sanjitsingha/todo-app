import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
// Just these icons, not the whole icon set.
import ChartPie from 'lucide-react-native/icons/chart-pie';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import LayoutList from 'lucide-react-native/icons/layout-list';
import StickyNote from 'lucide-react-native/icons/sticky-note';
import UserRound from 'lucide-react-native/icons/user-round';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FEATURES } from '@/constants/features';
import { createThemedStyles, useColors } from '@/hooks/useTheme';

const TAB_ICON_SIZE = 22;
/** Space between an icon and its name. */
const LABEL_GAP = 6;

type TabConfig = {
  /** Shown under the icon. */
  label: string;
  /** The tab's icon, in `color` (dark when the tab is open, gray otherwise). */
  renderIcon: (color: string) => ReactNode;
};

// Keys are route names from src/app/(tabs)/.
const TABS = {
  // Lucide icons are outlines only, so the open tab shows by its color.
  index: {
    label: 'Today',
    renderIcon: (color) => <LayoutList size={TAB_ICON_SIZE} color={color} />,
  },
  stats: {
    label: 'Stats',
    renderIcon: (color) => <ChartPie size={TAB_ICON_SIZE} color={color} />,
  },
  sticky: {
    label: 'Sticky',
    renderIcon: (color) => <StickyNote size={TAB_ICON_SIZE} color={color} />,
  },
  profile: {
    label: 'Profile',
    renderIcon: (color) => <UserRound size={TAB_ICON_SIZE} color={color} />,
  },
} satisfies Record<string, TabConfig>;

type TabName = keyof typeof TABS;

/**
 * Bottom navbar, evenly spaced, each an icon with its name under it: Today (the Todo screen),
 * Add Todo, Stats, Sticky (the sticky note wall, while it's hidden: see FEATURES), and Profile.
 * The open tab is dark, the rest gray. Add Todo is not a tab: a plain button like the tabs
 * around it, in their gray, that opens the Add todo sheet above the current tab.
 */
export function BottomNavBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const renderTab = (name: TabName) => {
    const index = state.routes.findIndex((route) => route.name === name);
    if (index === -1) return null;

    const route = state.routes[index];
    const focused = state.index === index;
    const tab = TABS[name];

    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tab}
        android_ripple={{ color: colors.ripple, borderless: true, radius: 28 }}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: focused }}
      >
        {tab.renderIcon(focused ? colors.ink : colors.iconInactive)}
        <Text style={[styles.label, focused && styles.labelFocused]}>{tab.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {renderTab('index')}

        <Pressable
          onPress={() => router.push('/add')}
          style={styles.tab}
          android_ripple={{ color: colors.ripple, borderless: true, radius: 28 }}
          accessibilityRole="button"
          accessibilityLabel="Add todo"
        >
          {/* Android shows a ripple; iOS dims the icon and name while pressed. */}
          {({ pressed }) => (
            <View
              style={[styles.content, pressed && Platform.OS !== 'android' && styles.pressed]}
            >
              <CirclePlus size={TAB_ICON_SIZE} color={colors.iconInactive} />
              <Text style={styles.label}>Add Todo</Text>
            </View>
          )}
        </Pressable>

        {renderTab('stats')}
        {FEATURES.sticky ? renderTab('sticky') : null}
        {renderTab('profile')}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Icon over name, centered in an equal share of the bar.
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LABEL_GAP,
  },
  content: {
    alignItems: 'center',
    gap: LABEL_GAP,
  },
  pressed: {
    opacity: 0.5,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    color: colors.iconInactive,
  },
  labelFocused: {
    fontWeight: '600',
    color: colors.ink,
  },
}));
