// Just these icons, not the whole icon set.
import Circle from 'lucide-react-native/icons/circle';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import { useMemo, type ReactElement } from 'react';
import { Platform, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DayHeading } from '@/components/DayHeading';
import { ActionBadge } from '@/components/reporting/ActionBadge';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { groupByDay, type ActivityEvent } from '@/lib/activity';
import type { DateKey } from '@/lib/dates';
import type { AuthUser } from '@/store/auth';

const AVATAR_SIZE = 28;
const BADGE_SIZE = 16;
const TODO_ICON_SIZE = 14;

type Props = {
  events: readonly ActivityEvent[];
  today: DateKey;
  /** Whose activity it is: their picture, or initial, on each row. */
  user: AuthUser;
  /** The todos still on the phone, which can be opened. */
  openable: ReadonlySet<string>;
  onOpen: (todoId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Above the first day, such as a note that the account couldn't be reached. */
  header?: ReactElement;
  /** In place of the log when there's nothing to show. */
  empty: ReactElement;
};

/** One thing that happened: "You added", then the todo. Tapping it opens the todo, if it's here. */
function ActivityRow({
  event,
  user,
  canOpen,
  onOpen,
}: {
  event: ActivityEvent;
  user: AuthUser;
  canOpen: boolean;
  onOpen: (todoId: string) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const deleted = event.kind === 'deleted';
  const TodoIcon = event.kind === 'completed' ? CircleCheck : Circle;
  return (
    <Pressable
      onPress={() => onOpen(event.todoId)}
      disabled={!canOpen}
      style={({ pressed }) => [
        styles.row,
        // Android shows a ripple instead.
        pressed && Platform.OS !== 'android' && styles.rowPressed,
      ]}
      android_ripple={canOpen ? { color: colors.ripple } : undefined}
      accessibilityRole={canOpen ? 'button' : 'text'}
      accessibilityLabel={`You ${event.kind} ${event.title}`}
      accessibilityHint={canOpen ? 'Opens the todo' : undefined}
    >
      <View>
        <Avatar uri={user.avatarUrl} name={user.name} email={user.email} size={AVATAR_SIZE} />
        <ActionBadge type={event.kind} size={BADGE_SIZE} ring={colors.page} style={styles.badge} />
      </View>
      <Text style={styles.who}>You {event.kind}</Text>
      <View style={styles.chip}>
        <TodoIcon
          size={TODO_ICON_SIZE}
          color={event.kind === 'completed' ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.chipText, deleted && styles.chipTextDeleted]} numberOfLines={1}>
          {event.title}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The Reporting log: what happened to your todos, newest first, under a heading for each day
 * with how much happened that day. A list that only draws the rows on screen, so a long history
 * stays light (the web app shows it a page at a time instead). Pull down to load it again.
 */
export function ActivityFeed({
  events,
  today,
  user,
  openable,
  onOpen,
  refreshing,
  onRefresh,
  header,
  empty,
}: Props) {
  const styles = useStyles();
  const colors = useColors();
  const sections = useMemo(
    () => groupByDay(events).map(({ day, items }) => ({ day, data: items })),
    [events],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(event) => event.id}
      renderItem={({ item }) => (
        <ActivityRow
          event={item}
          user={user}
          canOpen={openable.has(item.todoId)}
          onOpen={onOpen}
        />
      )}
      renderSectionHeader={({ section }) => (
        <DayHeading day={section.day} today={today} count={section.data.length} />
      )}
      renderSectionFooter={() => <View style={styles.dayFooter} />}
      stickySectionHeadersEnabled
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
          tintColor={colors.textMuted}
        />
      }
    />
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Grows to fill the screen when empty, so the empty message can sit in the middle.
  content: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  dayFooter: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  // On the avatar's lower right corner.
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
  },
  who: {
    fontSize: 14,
    color: colors.text,
  },
  // Takes the room left, and shortens a long name to fit.
  chip: {
    flexShrink: 1,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.text,
  },
  chipTextDeleted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
}));
