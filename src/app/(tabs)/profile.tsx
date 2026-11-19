import { useRouter } from 'expo-router';
// Just these icons, not the whole icon set.
import Bot from 'lucide-react-native/icons/bot';
import CalendarSync from 'lucide-react-native/icons/calendar-sync';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import LogOut from 'lucide-react-native/icons/log-out';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import Vibrate from 'lucide-react-native/icons/vibrate';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import { colors } from '@/constants/theme';
import { logOut, useAuth } from '@/store/auth';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  refreshCalendar,
  useCalendar,
} from '@/store/calendar';

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
 * Asks first. Logging out goes to the login screen (signing in is required); the todos stay on
 * the phone, and they're in the account.
 */
function confirmLogOut() {
  Alert.alert('Log out?', 'Your todos are saved in your account. Log back in to see them.', [
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

/**
 * Google Calendar: "Connect Google Calendar" opens Google's page to allow it; once connected,
 * the todos go, one way, to a "Dooist" calendar in that Google account (src/store/calendar.ts).
 * Connected, it says so, and a tap offers to disconnect. If it stopped by itself (the access was
 * removed in Google, or the calendar deleted), it offers to reconnect.
 */
function CalendarRow({ userId }: { userId: string }) {
  const calendar = useCalendar();
  const [busy, setBusy] = useState(false);
  const mine = calendar.userId === userId;
  const connected = mine && calendar.connected;
  const problem = mine ? calendar.problem : undefined;

  // The latest from the account each time Profile opens (it may have changed elsewhere).
  useEffect(() => {
    refreshCalendar(userId).catch(() => {
      // Offline: what's saved on the phone shows meanwhile.
    });
  }, [userId]);

  const connect = async () => {
    setBusy(true);
    const failure = await connectGoogleCalendar(userId);
    setBusy(false);
    if (failure) Alert.alert('Couldn’t connect Google Calendar', failure);
  };

  const disconnect = async () => {
    setBusy(true);
    const failure = await disconnectGoogleCalendar(userId);
    setBusy(false);
    if (failure) Alert.alert('Couldn’t disconnect Google Calendar', failure);
  };

  const onPress = () => {
    if (busy) return;
    if (!connected) {
      void connect();
      return;
    }
    const where = calendar.email ? ` in ${calendar.email}` : '';
    Alert.alert(
      'Google Calendar',
      `Your todos go to the Dooist calendar${where}. Disconnecting stops that; the calendar and its events stay in Google Calendar.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() },
      ],
    );
  };

  let title = 'Connect Google Calendar';
  if (connected) title = 'Google Calendar';
  else if (problem) title = 'Reconnect Google Calendar';

  let accessory: ReactNode;
  if (busy) accessory = <ActivityIndicator color={colors.ink} />;
  else if (connected) accessory = <Text style={styles.status}>Connected</Text>;

  return <Row icon={CalendarSync} title={title} accessory={accessory} onPress={onPress} />;
}

/**
 * The Profile tab: the app's settings and accounts, top to bottom: Haptic Feedback, Appearance,
 * Check for Updates, Google Calendar, Connect ChatGPT, Privacy Policy, then Log Out (signing in
 * is required, so someone always is). The settings open bottom sheets: so far Haptic Feedback
 * and Appearance (src/app/haptic-feedback.tsx, src/app/appearance.tsx); Google Calendar
 * connects in the in-app browser; the rest are in place for what comes next.
 */
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
      {/* No one's signed in only for a moment, while logging out moves to the login screen. */}
      {user ? <CalendarRow userId={user.id} /> : null}
      <Row icon={Bot} title="Connect ChatGPT" />
      <Row icon={ShieldCheck} title="Privacy Policy" />
      <Row icon={LogOut} title="Log Out" destructive accessory={null} onPress={confirmLogOut} />
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
  status: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
