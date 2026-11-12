import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { DateHeader } from '@/components/DateHeader';
import { DateStrip } from '@/components/DateStrip';
import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { ScreenPlaceholder, type IconName } from '@/components/ScreenPlaceholder';
import { TodoItem } from '@/components/TodoItem';
import { colors } from '@/constants/theme';
import { formatDayPhrase, fromDateKey } from '@/lib/dates';
import { useSelectedDate } from '@/store/selectedDate';
import { useTodos, type Todo } from '@/store/todos';

type StatusFilter = 'all' | 'pending' | 'completed';

const FILTER_OPTIONS: DropdownOption<StatusFilter>[] = [
  { value: 'all', label: 'All todos' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

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

function matchesFilter(todo: Todo, filter: StatusFilter): boolean {
  if (filter === 'pending') return !todo.completed;
  if (filter === 'completed') return todo.completed;
  return true;
}

const keyExtractor = (todo: Todo) => todo.id;
const renderTodo = ({ item }: { item: Todo }) => <TodoItem todo={item} />;

export default function TodoScreen() {
  const { todos } = useTodos();
  const { today, selectedDate, selectDate } = useSelectedDate();
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Todos due on the day picked in the strip that match the filter, in the order they were added.
  const visibleTodos = useMemo(
    () =>
      todos
        .filter((todo) => todo.dueDate === selectedDate && matchesFilter(todo, filter))
        .sort((a, b) => a.createdAt - b.createdAt),
    [todos, selectedDate, filter],
  );

  const emptyState = EMPTY_STATES[filter];

  return (
    <View style={styles.screen}>
      <DateHeader date={fromDateKey(selectedDate)} />
      <DateStrip today={today} selectedDate={selectedDate} onSelectDate={selectDate} />

      {/* Everything below the date strip sits on plain white. */}
      <View style={styles.section}>
        <View style={styles.toolbar}>
          <Dropdown
            value={filter}
            options={FILTER_OPTIONS}
            onChange={setFilter}
            accessibilityLabel="Show"
          />
        </View>

        {visibleTodos.length === 0 ? (
          <ScreenPlaceholder
            icon={emptyState.icon}
            title={emptyState.title}
            subtitle={emptyState.message(formatDayPhrase(selectedDate, today))}
          />
        ) : (
          <FlatList
            data={visibleTodos}
            keyExtractor={keyExtractor}
            renderItem={renderTodo}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  section: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  list: {
    paddingBottom: 16,
  },
});
