import { useMemo } from 'react';
import { SectionList, View } from 'react-native';

import { AddTodoFab, FAB_CLEARANCE } from '@/components/AddTodoFab';
import { DayHeading } from '@/components/DayHeading';
import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { TodoItem } from '@/components/TodoItem';
import { createThemedStyles } from '@/hooks/useTheme';
import type { DateKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { compareTodos, useTodos, type Todo } from '@/store/todos';

/**
 * The Upcoming tab, as on the web app: every open todo due after today, soonest first, under a
 * heading for the day it's due with how many are due then. Today has its own tab. Each todo is
 * the same card as on Today: tap it to open its details, or tick it off, which takes it off
 * this list.
 */
export default function UpcomingScreen() {
  const styles = useStyles();
  const { todos } = useTodos();
  const { todayKey } = useSelectedDate();

  const sections = useMemo(() => {
    const upcoming = todos
      .filter((todo) => !todo.completed && todo.dueDate > todayKey)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || compareTodos(a, b));
    const days = new Map<DateKey, Todo[]>();
    for (const todo of upcoming) {
      const list = days.get(todo.dueDate);
      if (list) list.push(todo);
      else days.set(todo.dueDate, [todo]);
    }
    return [...days].map(([day, data]) => ({ day, data }));
  }, [todos, todayKey]);

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(todo) => todo.id}
        renderItem={({ item }) => <TodoItem todo={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.heading}>
            <DayHeading day={section.day} today={todayKey} count={section.data.length} />
          </View>
        )}
        renderSectionFooter={() => <View style={styles.dayGap} />}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <ScreenPlaceholder
            icon="calendar-outline"
            title="No upcoming todos"
            subtitle="Todos due after today will show up here."
          />
        }
        contentContainerStyle={styles.content}
      />
      <AddTodoFab />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
  },
  // Grows to fill the screen when empty, so the empty message can sit in the middle; room at
  // the end for the last card to scroll up clear of the Add todo button.
  content: {
    flexGrow: 1,
    paddingBottom: FAB_CLEARANCE,
  },
  // Room between a day's line and its first card, kept on the page's color as it stays at the
  // top while its day scrolls under it.
  heading: {
    paddingBottom: 8,
    backgroundColor: colors.page,
  },
  // Between one day's last card (which has 8 below it already) and the next day.
  dayGap: {
    height: 8,
  },
}));
