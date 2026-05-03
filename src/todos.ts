import type { Filter, Todo } from './types';

export type CreateTodoInput = {
  text: string;
  createdBy: string;
  assignedTo?: string | null;
  dueAt?: number | null;
};

export function createTodo(input: CreateTodoInput): Todo {
  return {
    id: crypto.randomUUID(),
    text: input.text.trim(),
    done: false,
    createdAt: Date.now(),
    createdBy: input.createdBy,
    assignedTo: input.assignedTo ?? null,
    dueAt: input.dueAt ?? null,
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

export function setAssignee(
  todos: Todo[],
  id: string,
  assignedTo: string | null,
): Todo[] {
  return todos.map((t) => (t.id === id ? { ...t, assignedTo } : t));
}

export function setDueAt(
  todos: Todo[],
  id: string,
  dueAt: number | null,
): Todo[] {
  return todos.map((t) => (t.id === id ? { ...t, dueAt } : t));
}

export function clearAssignee(todos: Todo[], personId: string): Todo[] {
  return todos.map((t) =>
    t.assignedTo === personId ? { ...t, assignedTo: null } : t,
  );
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
