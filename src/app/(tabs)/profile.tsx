import { useRouter } from 'expo-router';
import { useUpdates } from 'expo-updates';
// Just these icons, not the whole icon set.
import Blocks from 'lucide-react-native/icons/blocks';
import CalendarSync from 'lucide-react-native/icons/calendar-sync';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import LogOut from 'lucide-react-native/icons/log-out';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import Vibrate from 'lucide-react-native/icons/vibrate';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { logOut, useAuth } from '@/store/auth';
import { refreshCalendar, useCalendar } from '@/store/calendar';

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
  const styles = useStyles();
  const colors = useColors();
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
 * Calendar: opens the Calendar page (src/app/calendar.tsx), where Google Calendar is connected,
 * its events shown in Dooist, and todo sync switched on or off. Says Connected while it is.
 */
function CalendarRow({ userId }: { userId: string }) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const calendar = useCalendar();
  const connected = calendar.userId === userId && calendar.connected;

  // The latest from the account each time Profile opens (it may have changed elsewhere).
  useEffect(() => {
    refreshCalendar(userId).catch(() => {
      // Offline: what's saved on the phone shows meanwhile.
    });
  }, [userId]);

  return (
    <Row
      icon={CalendarSync}
      title="Calendar"
      accessory={
        connected ? (
          <View style={styles.accessory}>
            <Text style={styles.status}>Connected</Text>
            <ChevronRight size={18} color={colors.iconInactive} />
          </View>
        ) : undefined
      }
      onPress={() => router.push('/calendar')}
    />
  );
}

/**
 * The Profile tab: the app's settings and accounts, top to bottom: Account, Haptic Feedback,
 * Appearance, Check for Updates, Calendar, Integrations, Privacy Policy, then Log Out (signing
 * in is required, so someone always is). Account and Check for Updates open pages of their own
 * (src/app/account.tsx, src/app/updates.tsx); Haptic Feedback and Appearance open bottom sheets
 * (src/app/haptic-feedback.tsx, src/app/appearance.tsx); Calendar and Integrations open their
 * pages (src/app/calendar.tsx, src/app/integrations.tsx); Privacy Policy is in place for what
 * comes next. The bell in the header opens
 * Notifications.
 */
export default function ProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  // The app checks for updates each time it opens and downloads one in the background; once it's
  // down, Check for Updates says so before it's even tapped.
  const { isUpdatePending } = useUpdates();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Row icon={CircleUserRound} title="Account" onPress={() => router.push('/account')} />
      <Row
        icon={Vibrate}
        title="Haptic Feedback"
        onPress={() => router.push('/haptic-feedback')}
      />
      <Row icon={SunMoon} title="Appearance" onPress={() => router.push('/appearance')} />
      <Row
        icon={RefreshCw}
        title="Check for Updates"
        accessory={isUpdatePending ? <Text style={styles.status}>Update ready</Text> : undefined}
        onPress={() => router.push('/updates')}
      />
      {/* No one's signed in only for a moment, while logging out moves to the login screen. */}
      {user ? <CalendarRow userId={user.id} /> : null}
      {/* The web app's Integrations icon. */}
      <Row icon={Blocks} title="Integrations" onPress={() => router.push('/integrations')} />
      <Row icon={ShieldCheck} title="Privacy Policy" />
      <Row icon={LogOut} title="Log Out" destructive accessory={null} onPress={confirmLogOut} />
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
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
  // A status with the chevron after it.
  accessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
}));
