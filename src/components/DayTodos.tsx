import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

import { CompletedSection } from '@/components/CompletedSection';
import { ScreenPlaceholder, type IconName } from '@/components/ScreenPlaceholder';
import { TodoItem } from '@/components/TodoItem';
import { TodoTimeline } from '@/components/TodoTimeline';
import { formatDayPhrase, type DateKey } from '@/lib/dates';
import { useTodos, type Todo } from '@/store/todos';

export type StatusFilter = 'all' | 'pending' | 'completed';

const EMPTY_STATES: Record<
  StatusFilter,
  { icon: IconName; title: string; message: (day: string) => string }
> = {
  all: {
    icon: 'list-outline',
    title: 'No todos',
    message: (day) => `Nothing due ${day}. Tap + to add one.`,
  },
  pending: {
    icon: 'time-outline',
    title: 'Nothing pending',
    message: (day) => `No open todos ${day}.`,
  },
  completed: {
    icon: 'checkmark-done-outline',
    title: 'Nothing completed',
    message: (day) => `No finished todos ${day}.`,
  },
};

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
  filter: StatusFilter;
  showTimeline: boolean;
};

/**
 * One day's todos, as a list of cards or as a timeline: a page of the day pager
 * (src/components/DayPager.tsx).
 */
export const DayTodos = memo(function DayTodos({ date, today, filter, showTimeline }: Props) {
  const { pendingTodos, completedTodos } = useDayTodos(date);

  // "All todos": unfinished ones in the list, finished ones in a Completed section below it.
  // "Pending" / "Completed": just that one list.
  const listTodos = filter === 'completed' ? completedTodos : pendingTodos;
  const showCompletedSection = filter === 'all' && completedTodos.length > 0;
  const isEmpty = listTodos.length === 0 && !showCompletedSection;

  // The timeline shows every todo the filter lets through, finished ones included.
  const timelineTodos = useMemo(
    () =>
      filter === 'all'
        ? [...pendingTodos, ...completedTodos]
        : filter === 'pending'
          ? pendingTodos
          : completedTodos,
    [filter, pendingTodos, completedTodos],
  );

  if (showTimeline) return <TodoTimeline todos={timelineTodos} date={date} />;

  if (isEmpty) {
    const emptyState = EMPTY_STATES[filter];
    return (
      <ScreenPlaceholder
        icon={emptyState.icon}
        title={emptyState.title}
        subtitle={emptyState.message(formatDayPhrase(date, today))}
      />
    );
  }

  return (
    <FlatList
      data={listTodos}
      keyExtractor={keyExtractor}
      renderItem={renderTodo}
      ListFooterComponent={
        showCompletedSection ? <CompletedSection todos={completedTodos} /> : undefined
      }
      contentContainerStyle={styles.list}
    />
  );
});

const styles = StyleSheet.create({
  // A little room between the filter and the first todo card.
  list: {
    paddingTop: 8,
    paddingBottom: 16,
  },
});
