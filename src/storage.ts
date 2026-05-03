import type { Person, Todo } from './types';

const TODOS_KEY = 'todo-hanterare:todos:v2';
const PEOPLE_KEY = 'todo-hanterare:people:v1';
const ME_KEY = 'todo-hanterare:me:v1';

export function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(TODOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeTodo)
      .filter((t): t is Todo => t !== null);
  } catch {
    return [];
  }
}

export function saveTodos(todos: Todo[]): void {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

export function loadPeople(): Person[] {
  try {
    const raw = localStorage.getItem(PEOPLE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPerson);
  } catch {
    return [];
  }
}

export function savePeople(people: Person[]): void {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

export function loadMe(): string | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMe(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(ME_KEY);
    return;
  }
  localStorage.setItem(ME_KEY, JSON.stringify(id));
}

function isPerson(value: unknown): value is Person {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string';
}

function normalizeTodo(value: unknown): Todo | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;
  if (
    typeof t.id !== 'string' ||
    typeof t.text !== 'string' ||
    typeof t.done !== 'boolean' ||
    typeof t.createdAt !== 'number' ||
    typeof t.createdBy !== 'string' ||
    !(t.assignedTo === null || typeof t.assignedTo === 'string') ||
    !(t.dueAt === null || typeof t.dueAt === 'number')
  ) {
    return null;
  }
  return {
    id: t.id,
    text: t.text,
    done: t.done,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    assignedTo: (t.assignedTo as string | null) ?? null,
    dueAt: (t.dueAt as number | null) ?? null,
    archivedAt: typeof t.archivedAt === 'number' ? t.archivedAt : null,
  };
}
