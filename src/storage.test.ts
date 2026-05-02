import { beforeEach, describe, expect, it } from 'vitest';
import { loadTodos, saveTodos } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('storage', () => {
  it('round-trips todos', () => {
    const todos = [{ id: '1', text: 'a', done: false, createdAt: 1 }];
    saveTodos(todos);
    expect(loadTodos()).toEqual(todos);
  });

  it('returns empty array when nothing stored', () => {
    expect(loadTodos()).toEqual([]);
  });

  it('returns empty array when stored value is invalid JSON', () => {
    localStorage.setItem('todo-hanterare:todos:v1', 'not json');
    expect(loadTodos()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    localStorage.setItem(
      'todo-hanterare:todos:v1',
      JSON.stringify([
        { id: '1', text: 'ok', done: false, createdAt: 1 },
        { nope: true },
      ]),
    );
    expect(loadTodos()).toHaveLength(1);
  });
});
