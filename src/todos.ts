import type { Filter, Todo } from './types';

export function createTodo(text: string): Todo {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    done: false,
    createdAt: Date.now(),
  };
}

export function toggle(todos: Todo[], id: string): Todo[] {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function remove(todos: Todo[], id: string): Todo[] {
  return todos.filter((t) => t.id !== id);
}

export function rename(todos: Todo[], id: string, text: string): Todo[] {
  const trimmed = text.trim();
  if (!trimmed) return remove(todos, id);
  return todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t));
}

export function clearDone(todos: Todo[]): Todo[] {
  return todos.filter((t) => !t.done);
}

export function applyFilter(todos: Todo[], filter: Filter): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.done);
    case 'done':
      return todos.filter((t) => t.done);
    case 'all':
    default:
      return todos;
  }
}
