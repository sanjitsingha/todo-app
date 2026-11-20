import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

import { CompletedSection } from '@/components/CompletedSection';
import { DayEvents } from '@/components/DayEvents';
import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { TodoItem } from '@/components/TodoItem';
import { TodoTimeline } from '@/components/TodoTimeline';
import { formatDayPhrase, type DateKey } from '@/lib/dates';
import { useAuth } from '@/store/auth';
import { useDayEvents } from '@/store/calendarEvents';
import { useTodos, type Todo } from '@/store/todos';

// Comes after every "HH:mm" time in a plain string comparison, so todos without a time go last.
const UNTIMED = '~';

function compareTodos(a: Todo, b: Todo): number {
  const timeA = a.dueTime ?? UNTIMED;
  const timeB = b.dueTime ?? UNTIMED;
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  return a.createdAt - b.createdAt;
}

/**
 * The todos due on a day, split by status. Ones with a time come first, earliest first; the
 * rest follow in the order they were added.
 */
export function useDayTodos(date: DateKey) {
  const { todos } = useTodos();
  return useMemo(() => {
    const dayTodos = todos.filter((todo) => todo.dueDate === date).sort(compareTodos);
    return {
      pendingTodos: dayTodos.filter((todo) => !todo.completed),
      completedTodos: dayTodos.filter((todo) => todo.completed),
    };
  }, [todos, date]);
}

const keyExtractor = (todo: Todo) => todo.id;
const renderTodo = ({ item }: { item: Todo }) => <TodoItem todo={item} />;

type Props = {
  date: DateKey;
  /** The real current date, for "today" / "tomorrow" in the empty state. */
  today: Date;
  showTimeline: boolean;
};

/**
 * One day's todos, as a list of cards or as a timeline: a page of the day pager
 * (src/components/DayPager.tsx). With Events on (the Calendar page), the day's Google Calendar
 * events sit above them.
 */
export const DayTodos = memo(function DayTodos({ date, today, showTimeline }: Props) {
  const { pendingTodos, completedTodos } = useDayTodos(date);
  const { user } = useAuth();
  const events = useDayEvents(date, user?.id ?? null);
  const eventsHeader = events.length > 0 ? <DayEvents events={events} date={date} /> : null;

  // The cards: unfinished todos in the list, finished ones in a Completed section below it.
  const showCompletedSection = completedTodos.length > 0;
  const isEmpty = pendingTodos.length === 0 && !showCompletedSection;

  // The timeline shows every todo, finished ones included.
  const timelineTodos = useMemo(
    () => [...pendingTodos, ...completedTodos],
    [pendingTodos, completedTodos],
  );

  if (showTimeline) {
    if (!eventsHeader) return <TodoTimeline todos={timelineTodos} date={date} />;
    return (
      <View style={styles.fill}>
        <View style={styles.timelineEvents}>{eventsHeader}</View>
        <TodoTimeline todos={timelineTodos} date={date} />
      </View>
    );
  }

  // No todos, and no events either.
  if (isEmpty && !eventsHeader) {
    return (
      <ScreenPlaceholder
        icon="list-outline"
        title="No todos"
        subtitle={`Nothing due ${formatDayPhrase(date, today)}. Tap + to add one.`}
      />
    );
  }

  return (
    <FlatList
      data={pendingTodos}
      keyExtractor={keyExtractor}
      renderItem={renderTodo}
      ListHeaderComponent={eventsHeader ?? undefined}
      ListFooterComponent={
        showCompletedSection ? <CompletedSection todos={completedTodos} /> : undefined
      }
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // The list has its own room at the top; above the timeline, the events need some.
  timelineEvents: {
    paddingTop: 12,
  },
  // A little room between the date strip and the first todo card.
  list: {
    paddingTop: 12,
    paddingBottom: 16,
  },
});
