import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  label: string;
  icon: IconName;
  iconFocused: IconName;
};

// Keys are route names from src/app/(tabs)/.
const TABS = {
  index: { label: 'Todo', icon: 'list-outline', iconFocused: 'list' },
  settings: { label: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
} satisfies Record<string, TabConfig>;

type TabName = keyof typeof TABS;

/**
 * Bottom navbar: Todo on the left, a round "+" in the middle, Settings on the right.
 * The "+" is not a tab. It opens the Add todo screen above the current tab.
 */
export function BottomNavBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
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
        <Ionicons
          name={focused ? tab.iconFocused : tab.icon}
          size={26}
          color={focused ? colors.ink : colors.iconInactive}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {renderTab('index')}

        <Pressable
          onPress={() => router.push('/add')}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add todo"
        >
          <Ionicons name="add" size={32} color={colors.onPrimary} />
        </Pressable>

        {renderTab('settings')}
      </View>
    </View>
  );
}

const ADD_BUTTON_SIZE = 56;

const styles = StyleSheet.create({
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
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.95 }],
  },
});
