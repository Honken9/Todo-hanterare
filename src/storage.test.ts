import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadMe,
  loadPeople,
  loadTodos,
  saveMe,
  savePeople,
  saveTodos,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('todo storage', () => {
  it('round-trips todos', () => {
    const todos = [
      {
        id: '1',
        text: 'a',
        done: false,
        createdAt: 1,
        createdBy: 'p1',
        assignedTo: null,
        dueAt: null,
      },
    ];
    saveTodos(todos);
    expect(loadTodos()).toEqual(todos);
  });

  it('returns empty array when nothing stored', () => {
    expect(loadTodos()).toEqual([]);
  });

  it('returns empty array when stored value is invalid JSON', () => {
    localStorage.setItem('todo-hanterare:todos:v2', 'not json');
    expect(loadTodos()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    localStorage.setItem(
      'todo-hanterare:todos:v2',
      JSON.stringify([
        {
          id: '1',
          text: 'ok',
          done: false,
          createdAt: 1,
          createdBy: 'p1',
          assignedTo: null,
          dueAt: null,
        },
        { nope: true },
      ]),
    );
    expect(loadTodos()).toHaveLength(1);
  });
});

describe('people storage', () => {
  it('round-trips people', () => {
    const people = [{ id: '1', name: 'Anna' }];
    savePeople(people);
    expect(loadPeople()).toEqual(people);
  });

  it('returns empty array when nothing stored', () => {
    expect(loadPeople()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    localStorage.setItem(
      'todo-hanterare:people:v1',
      JSON.stringify([{ id: '1', name: 'Anna' }, { nope: true }]),
    );
    expect(loadPeople()).toHaveLength(1);
  });
});

describe('me storage', () => {
  it('round-trips current user id', () => {
    saveMe('p1');
    expect(loadMe()).toBe('p1');
  });

  it('clears with null', () => {
    saveMe('p1');
    saveMe(null);
    expect(loadMe()).toBeNull();
  });

  it('returns null when nothing stored', () => {
    expect(loadMe()).toBeNull();
  });
});
