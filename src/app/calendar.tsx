import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OverflowMenu } from '@/components/OverflowMenu';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useAuth } from '@/store/auth';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  refreshCalendar,
  resyncGoogleCalendar,
  setShowEvents,
  setTodoSync,
  useCalendar,
} from '@/store/calendar';
import { clearCalendarEvents, refreshCalendarEvents } from '@/store/calendarEvents';

/** What's under way, so the controls it touches wait. */
type Busy = 'connect' | 'resync' | 'disconnect' | 'events' | 'sync' | null;

/** A section's title, above its rows. */
function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

type SwitchRowProps = {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
};

/** A setting that's on or off: its name and a line about it, with the switch at the right. */
function SwitchRow({ title, description, value, disabled, onChange }: SwitchRowProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.onPrimary}
        ios_backgroundColor={colors.border}
        accessibilityLabel={title}
      />
    </View>
  );
}

/** The page's main button: Connect Google Calendar, or Reconnect. */
function MainButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

/**
 * The Calendar page, opened from Profile:
 * - Account: the Google account the todos go to, with Resync (send every todo again) and
 *   Disconnect in its ⋮ menu; or a button to connect (or reconnect, if it stopped by itself).
 * - Events: shows the person's Google Calendar events in Today, read-only. Turning it on the
 *   first time asks Google for permission to read them.
 * - Todo sync: sends the todos to the Dooist calendar. On by default; off, new changes stay in
 *   Dooist and what's in Google Calendar stays.
 * The work is done by the google-calendar function (src/store/calendar.ts,
 * src/store/calendarEvents.ts).
 */
export default function CalendarScreen() {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const calendar = useCalendar();
  const [busy, setBusy] = useState<Busy>(null);

  // The latest from the account each time the page opens (it may have changed elsewhere).
  useEffect(() => {
    if (!userId) return;
    refreshCalendar(userId).catch(() => {
      // Offline: what's saved on the phone shows meanwhile.
    });
  }, [userId]);

  if (!userId) return <View style={styles.page} />;

  const mine = calendar.userId === userId;
  const connected = mine && calendar.connected;
  const problem = mine ? calendar.problem : undefined;

  /** Runs one action at a time, and shows what went wrong, if anything. */
  const run = async (
    kind: Exclude<Busy, null>,
    action: () => Promise<string | null>,
    failureTitle: string,
  ) => {
    if (busy) return null;
    setBusy(kind);
    const failure = await action();
    setBusy(null);
    if (failure) Alert.alert(failureTitle, failure);
    return failure;
  };

  const connect = () =>
    void run('connect', () => connectGoogleCalendar(userId), 'Couldn’t connect Google Calendar');

  const resync = async () => {
    const failure = await run(
      'resync',
      () => resyncGoogleCalendar(userId),
      'Couldn’t resync Google Calendar',
    );
    if (failure === null) Alert.alert('Resynced', 'Your todos were sent to Google Calendar again.');
  };

  const disconnect = () => {
    const where = calendar.email ? ` ${calendar.email}` : '';
    Alert.alert(
      'Disconnect Google Calendar?',
      `Dooist stops sending todos to${where || ' Google'} and stops showing your events. The Dooist calendar and its events stay in Google Calendar.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () =>
            void run(
              'disconnect',
              async () => {
                const failure = await disconnectGoogleCalendar(userId);
                if (!failure) clearCalendarEvents();
                return failure;
              },
              'Couldn’t disconnect Google Calendar',
            ),
        },
      ],
    );
  };

  const toggleEvents = (value: boolean) =>
    void run(
      'events',
      async () => {
        const failure = await setShowEvents(userId, value);
        if (value) await refreshCalendarEvents(userId).catch(() => {});
        else clearCalendarEvents();
        return failure;
      },
      'Couldn’t change Events',
    );

  const toggleSync = (value: boolean) =>
    void run('sync', () => setTodoSync(userId, value), 'Couldn’t change Todo sync');

  let account: ReactNode;
  if (connected) {
    account = (
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {calendar.email ?? 'Google account'}
          </Text>
          <Text style={styles.rowDescription}>Google Calendar</Text>
        </View>
        {busy === 'resync' || busy === 'disconnect' ? (
          <ActivityIndicator color={colors.textMuted} style={styles.spinner} />
        ) : (
          <OverflowMenu
            accessibilityLabel="Google account options"
            actions={[
              { label: 'Resync', onPress: () => void resync() },
              { label: 'Disconnect', onPress: disconnect, destructive: true },
            ]}
          />
        )}
      </View>
    );
  } else {
    const message =
      problem === 'revoked'
        ? 'Dooist’s access to your Google account was removed, so todos stopped going to Google Calendar. Reconnect to pick up again.'
        : problem === 'calendar_deleted'
          ? 'The Dooist calendar was deleted in Google Calendar, so todos stopped going there. Reconnect to make it again.'
          : 'Connect your Google account to send your todos to Google Calendar, and to see your events in Dooist.';
    account = (
      <View style={styles.connect}>
        <Text style={styles.connectText}>{message}</Text>
        <MainButton
          label={problem ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          onPress={connect}
          busy={busy === 'connect'}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <SectionTitle>Account</SectionTitle>
      {account}

      <View style={styles.divider} />
      <SectionTitle>Events</SectionTitle>
      <SwitchRow
        title="Show calendar events in Dooist"
        description="Events from your Google Calendar show in Today, next to your todos. Dooist only reads them."
        value={connected && calendar.showEvents}
        disabled={!connected || busy !== null}
        onChange={toggleEvents}
      />

      <View style={styles.divider} />
      <SectionTitle>Todo sync</SectionTitle>
      <SwitchRow
        title="Sync todos to Google Calendar"
        description="Your todos go to a calendar named Dooist. Off, new changes stay in Dooist, and what’s already in Google Calendar stays."
        value={connected && calendar.syncTodos}
        disabled={!connected || busy !== null}
        onChange={toggleSync}
      />
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingTop: 8,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.text,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spinner: {
    padding: 8,
  },
  connect: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  connectText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // Same as the app's other main buttons.
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: colors.divider,
  },
}));
