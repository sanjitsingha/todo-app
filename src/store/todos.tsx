import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DateKey } from '@/lib/dates';

export type Todo = {
  id: string;
  title: string;
  /** Not shown in the list; kept for the todo's detail view. */
  description?: string;
  dueDate: DateKey;
  completed: boolean;
  createdAt: number;
};

export type NewTodo = Pick<Todo, 'title' | 'description' | 'dueDate'>;

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
    // Todos saved before "completed" existed don't have the field yet.
    return parsed.map((todo: Todo) => ({ ...todo, completed: todo.completed === true }));
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
