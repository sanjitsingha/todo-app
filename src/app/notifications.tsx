import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNow } from '@/hooks/useNow';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { addDays, formatShortDate, formatTime, toDateKey, toTimeKey } from '@/lib/dates';
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  type AppNotification,
} from '@/store/notifications';

type Section = { title: string; data: AppNotification[] };

/** Newest first, under Today, Yesterday and Earlier (only the ones with any). */
function sectionsOf(list: readonly AppNotification[], now: Date): Section[] {
  const today = toDateKey(now);
  const yesterday = toDateKey(addDays(now, -1));
  const groups: Record<'Today' | 'Yesterday' | 'Earlier', AppNotification[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };
  for (const notification of [...list].sort((a, b) => b.at - a.at)) {
    const day = toDateKey(new Date(notification.at));
    if (day === today) groups.Today.push(notification);
    else if (day === yesterday) groups.Yesterday.push(notification);
    else groups.Earlier.push(notification);
  }
  return (Object.keys(groups) as (keyof typeof groups)[])
    .filter((title) => groups[title].length > 0)
    .map((title) => ({ title, data: groups[title] }));
}

/** "4:12 pm" today, "Yesterday", or the date ("Mon, 16 Nov") before that. */
function timeLabel(at: number, now: Date): string {
  const date = new Date(at);
  const day = toDateKey(date);
  if (day === toDateKey(now)) return formatTime(toTimeKey(date.getHours(), date.getMinutes()));
  if (day === toDateKey(addDays(now, -1))) return 'Yesterday';
  return formatShortDate(day, now);
}

/**
 * One notification, as plain text: its title and time, a line or two of detail, and a dot while
 * unread. No icons or colors per kind.
 */
function NotificationRow({ notification, now }: { notification: AppNotification; now: Date }) {
  const styles = useStyles();
  const colors = useColors();
  const unread = !notification.read;
  const time = timeLabel(notification.at, now);

  return (
    <Pressable
      onPress={() => markNotificationRead(notification.id)}
      style={({ pressed }) => [
        styles.row,
        // Android shows a ripple instead.
        pressed && Platform.OS !== 'android' && styles.rowPressed,
      ]}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body} ${time}.`}
      accessibilityHint={unread ? 'Marks it as read' : undefined}
    >
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>

      {/* Keeps its room when read, so the text doesn't shift. */}
      <View style={[styles.dot, !unread && styles.dotRead]} />
    </Pressable>
  );
}

/** What shows when there's nothing: just what will come here. */
function EmptyState() {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptyBody}>
        Reminders, todos due today and other news about your day will show up here.
      </Text>
    </View>
  );
}

/**
 * The Notifications page, opened from the bell in Profile's header: newest first, under Today,
 * Yesterday and Earlier. Tapping one marks it read; "Mark all read" in the header does them all.
 * Only the screen for now: the list lives in src/store/notifications.ts, with made-up ones
 * while developing, until notifications come from the app and the account.
 */
export default function NotificationsScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const notifications = useNotifications();
  const sections = useMemo(() => sectionsOf(notifications, now), [notifications, now]);
  const unread = notifications.some((notification) => !notification.read);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: unread
            ? () => (
                <Pressable
                  onPress={markAllNotificationsRead}
                  hitSlop={8}
                  style={({ pressed }) => [styles.markAll, pressed && styles.markAllPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                >
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(notification) => notification.id}
        renderItem={({ item }) => <NotificationRow notification={item} now={now} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={[
          sections.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + 16 },
        ]}
      />
    </>
  );
}

const DOT_SIZE = 8;

const useStyles = createThemedStyles((colors) => ({
  list: {
    flex: 1,
    backgroundColor: colors.page,
  },
  // The empty state sits in the middle of the page.
  listEmpty: {
    flexGrow: 1,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  titleUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary,
  },
  dotRead: {
    backgroundColor: 'transparent',
  },
  markAll: {
    marginEnd: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllPressed: {
    opacity: 0.6,
  },
  markAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 64,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },
}));
