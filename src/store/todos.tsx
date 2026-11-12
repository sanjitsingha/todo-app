import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isTimeKey, type DateKey, type TimeKey } from '@/lib/dates';

export type Priority = 'high' | 'medium' | 'low';

export type Todo = {
  id: string;
  title: string;
  /** Shown when the todo's row is expanded. */
  description?: string;
  dueDate: DateKey;
  /** Time of day on the due date, if one was set. */
  dueTime?: TimeKey;
  priority: Priority;
  completed: boolean;
  createdAt: number;
};

export type NewTodo = Pick<Todo, 'title' | 'description' | 'dueDate' | 'dueTime' | 'priority'>;

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

type TodosContextValue = {
  todos: Todo[];
  addTodo: (todo: NewTodo) => void;
  toggleTodo: (id: string) => void;
};

const STORAGE_KEY = 'todos';

const TodosContext = createContext<TodosContextValue | null>(null);

function loadTodos(): Todo[] {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    // Todos saved before "completed" / "priority" existed don't have those fields yet.
    return parsed.map((todo: Todo) => ({
      ...todo,
      completed: todo.completed === true,
      priority: isPriority(todo.priority) ? todo.priority : 'medium',
      dueTime: isTimeKey(todo.dueTime) ? todo.dueTime : undefined,
    }));
  } catch (error) {
    console.warn('Could not load saved todos', error);
    return [];
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Holds the todo list and saves it on the device, so todos survive closing the app. */
export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);

  useEffect(() => {
    try {
      Storage.setItemSync(STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
      console.warn('Could not save todos', error);
    }
  }, [todos]);

  const addTodo = useCallback((todo: NewTodo) => {
    setTodos((current) => [
      ...current,
      { ...todo, id: createId(), completed: false, createdAt: Date.now() },
    ]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
    );
  }, []);

  const value = useMemo(() => ({ todos, addTodo, toggleTodo }), [todos, addTodo, toggleTodo]);

  return <TodosContext value={value}>{children}</TodosContext>;
}

export function useTodos(): TodosContextValue {
  const context = use(TodosContext);
  if (!context) {
    throw new Error('useTodos must be used inside <TodosProvider>');
  }
  return context;
}
