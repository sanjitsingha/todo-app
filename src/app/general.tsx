// Just this icon, not the whole icon set.
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionTitle, SwitchRow } from '@/components/SettingRows';
import { RECENTLY_DELETED_DAYS, useRecentlyDeleted } from '@/hooks/useRecentlyDeleted';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useToday } from '@/hooks/useToday';
import { formatDayPhrase, formatDueDateTime, fromDateKey, toDateKey } from '@/lib/dates';
import type { RecentlyDeletedTodo } from '@/lib/todoSync';
import { useAuth } from '@/store/auth';
import { setHideCompleted, useHideCompleted } from '@/store/hideCompleted';
import type { Todo } from '@/store/todos';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Deleted today", "Deleted yesterday" or "Deleted 3 days ago", by calendar day. */
function deletedAgo(at: number, now: Date): string {
  const days = Math.round(
    (fromDateKey(toDateKey(now)).getTime() - fromDateKey(toDateKey(new Date(at))).getTime()) /
      DAY_MS,
  );
  if (days <= 0) return 'Deleted today';
  if (days === 1) return 'Deleted yesterday';
  return `Deleted ${days} days ago`;
}

/** A deleted todo: its name, when it was due and deleted, and Restore at the right. */
function DeletedRow({
  entry: { todo, deletedAt },
  now,
  onRestore,
}: {
  entry: RecentlyDeletedTodo;
  now: Date;
  onRestore: (todo: Todo) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {todo.title}
        </Text>
        <Text style={styles.rowDescription}>
          {[
            `Due ${formatDueDateTime(todo.dueDate, todo.dueTime, now)}`,
            ...(todo.completed ? ['Done'] : []),
            deletedAgo(deletedAt, now),
          ].join(' · ')}
        </Text>
      </View>
      <Pressable
        onPress={() => onRestore(todo)}
        hitSlop={6}
        style={({ pressed }) => [styles.restore, pressed && styles.restorePressed]}
        accessibilityRole="button"
        accessibilityLabel={`Restore ${todo.title}`}
      >
        <RotateCcw size={16} color={colors.text} />
        <Text style={styles.restoreText}>Restore</Text>
      </Pressable>
    </View>
  );
}

/**
 * The General page, opened from Profile, as in the web app's Settings › General:
 * - Todos: Hide completed todos, which leaves the done ones out of the Todo tab, in the list and
 *   the timeline. Kept on this phone (src/store/hideCompleted.ts).
 * - Recently deleted: todos deleted in the last 30 days, on any device, each with Restore, which
 *   puts it back on its due date as it was (src/hooks/useRecentlyDeleted.ts).
 */
export default function GeneralScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const hideCompleted = useHideCompleted();
  const today = useToday();
  const { deleted, status, retry, restore } = useRecentlyDeleted(user?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const bringBack = (todo: Todo) => {
    restore(todo);
    setNotice(`“${todo.title}” is back, due ${formatDayPhrase(todo.dueDate, today)}.`);
  };

  const header = (
    <>
      <SectionTitle>Todos</SectionTitle>
      <SwitchRow
        title="Hide completed todos"
        description="Todos you’ve marked as done don’t show on the Todo tab, on this phone. Reporting still shows them."
        value={hideCompleted}
        onChange={setHideCompleted}
      />

      <View style={styles.divider} />
      <SectionTitle>Recently deleted</SectionTitle>
      <Text style={styles.intro}>
        Todos you deleted in the last {RECENTLY_DELETED_DAYS} days. Restore puts one back on its
        due date, just as it was.
      </Text>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </>
  );

  let empty;
  if (status === 'loading') {
    empty = <Text style={styles.message}>Loading…</Text>;
  } else if (status === 'error') {
    empty = (
      <View style={styles.errorRow}>
        <Text style={[styles.message, styles.errorText]}>Couldn’t load your deleted todos.</Text>
        <Pressable
          onPress={retry}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else {
    empty = (
      <Text style={styles.message}>Nothing deleted in the last {RECENTLY_DELETED_DAYS} days.</Text>
    );
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      data={deleted}
      keyExtractor={(entry) => entry.todo.id}
      renderItem={({ item }) => <DeletedRow entry={item} now={today} onRestore={bringBack} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
    />
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
  divider: {
    height: 1,
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: colors.divider,
  },
  intro: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  notice: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    fontSize: 14,
    lineHeight: 20,
    color: colors.success,
  },
  // Same as the switch rows (src/components/SettingRows.tsx).
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: colors.border,
  },
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restorePressed: {
    backgroundColor: colors.inputBackground,
  },
  restoreText: {
    fontSize: 14,
    color: colors.text,
  },
  message: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
  },
  errorText: {
    flex: 1,
  },
  retry: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
  },
  retryPressed: {
    backgroundColor: colors.border,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
}));
