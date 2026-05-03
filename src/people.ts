import type { Person } from './types';

export function createPerson(name: string): Person {
  return { id: crypto.randomUUID(), name: name.trim() };
}

export function removePerson(people: Person[], id: string): Person[] {
  return people.filter((p) => p.id !== id);
}

export function findPerson(
  people: Person[],
  id: string | null,
): Person | undefined {
  if (id === null) return undefined;
  return people.find((p) => p.id === id);
}
