import { supabase, type PersonRow, type TodoRow } from './lib/supabase';
import type { Person, Todo } from './types';

function rowToPerson(row: PersonRow): Person {
  return { id: row.id, name: row.name };
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by ?? '',
    assignedTo: row.assigned_to,
    dueAt: row.due_at ? new Date(row.due_at).getTime() : null,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

function toIso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToPerson);
}

export async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTodo);
}

export async function insertPerson(name: string): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) throw error;
}

export type InsertTodoInput = {
  text: string;
  createdBy: string;
  assignedTo: string | null;
  dueAt: number | null;
};

export async function insertTodo(input: InsertTodoInput): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert({
      text: input.text.trim(),
      created_by: input.createdBy,
      assigned_to: input.assignedTo,
      due_at: toIso(input.dueAt),
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTodo(data);
}

export async function updateTodo(
  id: string,
  patch: Partial<{
    text: string;
    done: boolean;
    assignedTo: string | null;
    dueAt: number | null;
    archivedAt: number | null;
  }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.text !== undefined) dbPatch.text = patch.text;
  if (patch.done !== undefined) dbPatch.done = patch.done;
  if (patch.assignedTo !== undefined) dbPatch.assigned_to = patch.assignedTo;
  if (patch.dueAt !== undefined) dbPatch.due_at = toIso(patch.dueAt);
  if (patch.archivedAt !== undefined)
    dbPatch.archived_at = toIso(patch.archivedAt);

  const { error } = await supabase.from('todos').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}

export type Subscriptions = { unsubscribe: () => void };

export function subscribeChanges(handlers: {
  onPeopleChange: () => void;
  onTodosChange: () => void;
}): Subscriptions {
  const channel = supabase
    .channel('public-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'people' },
      handlers.onPeopleChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      handlers.onTodosChange,
    )
    .subscribe();
  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export { rowToPerson, rowToTodo };
