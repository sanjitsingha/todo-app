import { useRouter } from 'expo-router';
// Just this icon, not the whole icon set.
import CloudOff from 'lucide-react-native/icons/cloud-off';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ActivityFeed } from '@/components/reporting/ActivityFeed';
import { DownloadReportButton } from '@/components/reporting/DownloadReportButton';
import { FilterButton } from '@/components/reporting/FilterButton';
import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { actionsSummary, isEveryType } from '@/constants/reportTypes';
import { useActivity } from '@/hooks/useActivity';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { dateChoiceSummary, matchesDate } from '@/lib/activity';
import { useAuth } from '@/store/auth';
import { useReportFilters } from '@/store/reportFilters';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos } from '@/store/todos';

/**
 * The Reporting tab, as on the web app: a log of what happened to your todos (added, updated,
 * completed, deleted), by day, newest first. Two filters under the header pick the actions
 * (src/app/report-actions.tsx) and the dates (src/app/report-date.tsx; it starts on today), and
 * the button beside them saves what they show as a PDF. Tapping a row opens its todo, if it's
 * still here. Pull down to load it again.
 */
export default function ReportingScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { todayKey } = useSelectedDate();
  const { todos } = useTodos();
  const { types, date } = useReportFilters();
  const { events, status, refreshing, refresh } = useActivity(user?.id ?? null);

  const openable = useMemo(() => new Set(todos.map((todo) => todo.id)), [todos]);
  const everyType = isEveryType(types);
  const shown = useMemo(
    () =>
      events.filter(
        (event) =>
          (everyType || types.includes(event.kind)) && matchesDate(event.at, date, todayKey),
      ),
    [events, everyType, types, date, todayKey],
  );

  // No one's signed in only for a moment, while logging out moves to the login screen.
  if (!user) return null;

  const person = user.name ?? user.email;
  const initial = person.trim().charAt(0).toUpperCase() || '?';
  const onlyUncompleted = types.length === 1 && types[0] === 'uncompleted';

  const empty = onlyUncompleted ? (
    <ScreenPlaceholder
      icon="time-outline"
      title="Uncompleted isn’t tracked yet"
      subtitle="Marking a todo as not done isn’t saved in your history."
    />
  ) : events.length === 0 && status === 'loading' ? (
    <View style={styles.loading} accessibilityLabel="Loading activity">
      <ActivityIndicator color={colors.textMuted} />
    </View>
  ) : events.length === 0 ? (
    <ScreenPlaceholder
      icon="time-outline"
      title="No activity yet"
      subtitle="Add a todo and it will show up here."
    />
  ) : (
    <ScreenPlaceholder
      icon="time-outline"
      title="No activity found"
      subtitle="Try a different action or date."
    />
  );

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <FilterButton
          label="Actions to report on"
          summary={actionsSummary(types)}
          onPress={() => router.push('/report-actions')}
        />
        <FilterButton
          label="Date"
          summary={dateChoiceSummary(date, todayKey)}
          onPress={() => router.push('/report-date')}
        />
        <View style={styles.spacer} />
        <DownloadReportButton
          events={shown}
          types={types}
          date={date}
          today={todayKey}
          person={person}
          initial={initial}
          disabled={status === 'loading' || shown.length === 0}
        />
      </View>

      <ActivityFeed
        // A new filter starts at the top.
        key={`${types.join()}|${date}`}
        events={shown}
        today={todayKey}
        user={user}
        openable={openable}
        onOpen={(id) => router.push({ pathname: '/todo/[id]', params: { id } })}
        refreshing={refreshing}
        onRefresh={refresh}
        header={
          status === 'offline' ? (
            <View style={styles.notice}>
              <CloudOff size={16} color={colors.textMuted} />
              <Text style={styles.noticeText}>
                Couldn’t reach your account, so todos deleted on other devices may be missing.
                Pull down to try again.
              </Text>
            </View>
          ) : undefined
        }
        empty={empty}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
  },
  // Stays put under the header while the log scrolls. The buttons have no box, so the row sits
  // further out, which lines their text up with the day headings below (18pt in).
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // Pushes the download button to the right edge.
  spacer: {
    flexGrow: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
}));
