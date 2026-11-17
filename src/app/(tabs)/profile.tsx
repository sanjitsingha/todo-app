import { useRouter } from 'expo-router';
// Just these icons, not the whole icon set.
import Bot from 'lucide-react-native/icons/bot';
import CalendarSync from 'lucide-react-native/icons/calendar-sync';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import Vibrate from 'lucide-react-native/icons/vibrate';
import type { ComponentType, ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';
import { logOut, useAuth } from '@/store/auth';

const ICON_SIZE = 22;

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

type RowProps = {
  icon: LucideIcon;
  title: string;
  /** Red, for leaving: Log out. */
  destructive?: boolean;
  /** What sits at the right end: a chevron unless given. */
  accessory?: ReactNode;
  onPress?: () => void;
};

/** A row of the list: Lucide icon, title, and a chevron (or `accessory`) at the right. */
function Row({ icon: Icon, title, destructive = false, accessory, onPress }: RowProps) {
  const tint = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        // Android shows a ripple instead.
        pressed && Platform.OS !== 'android' && styles.rowPressed,
      ]}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Icon size={ICON_SIZE} color={tint} />
      <Text style={[styles.rowTitle, destructive && { color: colors.danger }]}>{title}</Text>
      {accessory === undefined ? (
        <ChevronRight size={18} color={colors.iconInactive} />
      ) : (
        accessory
      )}
    </Pressable>
  );
}

/**
 * The Profile tab: the app's settings and accounts, top to bottom: Haptic Feedback, Appearance,
 * Check for Updates, Connect Google Calendar, Connect ChatGPT, Privacy Policy, then Log Out when
 * signed in, or Log In (which opens the login screen) when not. The settings open bottom sheets:
 * so far Haptic Feedback and Appearance (src/app/haptic-feedback.tsx, src/app/appearance.tsx);
 * the rest are in place for what comes next.
 */
/** Asks first. Signing out keeps the todos on the phone; they're in the account too. */
function confirmLogOut() {
  Alert.alert('Log out?', 'Your todos stay on this phone, and they’re saved in your account.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Log Out',
      style: 'destructive',
      onPress: async () => {
        const problem = await logOut();
        if (problem) Alert.alert('Couldn’t log out', problem);
      },
    },
  ]);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Row
        icon={Vibrate}
        title="Haptic Feedback"
        onPress={() => router.push('/haptic-feedback')}
      />
      <Row icon={SunMoon} title="Appearance" onPress={() => router.push('/appearance')} />
      <Row icon={RefreshCw} title="Check for Updates" />
      <Row icon={CalendarSync} title="Connect Google Calendar" />
      <Row icon={Bot} title="Connect ChatGPT" />
      <Row icon={ShieldCheck} title="Privacy Policy" />
      {user ? (
        <Row icon={LogOut} title="Log Out" destructive accessory={null} onPress={confirmLogOut} />
      ) : (
        <Row icon={LogIn} title="Log In" onPress={() => router.push('/login')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
});
