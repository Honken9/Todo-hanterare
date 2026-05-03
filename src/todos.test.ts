import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  clearAssignee,
  clearDone,
  createTodo,
  remove,
  rename,
  setAssignee,
  setDueAt,
  toggle,
} from './todos';
import type { Todo } from './types';

function fixture(): Todo[] {
  return [
    {
      id: '1',
      text: 'a',
      done: false,
      createdAt: 1,
      createdBy: 'p1',
      assignedTo: 'p1',
      dueAt: null,
    },
    {
      id: '2',
      text: 'b',
      done: true,
      createdAt: 2,
      createdBy: 'p1',
      assignedTo: 'p2',
      dueAt: 1000,
    },
    {
      id: '3',
      text: 'c',
      done: false,
      createdAt: 3,
      createdBy: 'p2',
      assignedTo: null,
      dueAt: null,
    },
  ];
}

describe('createTodo', () => {
  it('trims text and starts not done', () => {
    const t = createTodo({ text: '  hej  ', createdBy: 'p1' });
    expect(t.text).toBe('hej');
    expect(t.done).toBe(false);
    expect(t.id).toBeTruthy();
    expect(t.createdBy).toBe('p1');
    expect(t.assignedTo).toBeNull();
    expect(t.dueAt).toBeNull();
  });

  it('accepts assignee and due date', () => {
    const t = createTodo({
      text: 'x',
      createdBy: 'p1',
      assignedTo: 'p2',
      dueAt: 12345,
    });
    expect(t.assignedTo).toBe('p2');
    expect(t.dueAt).toBe(12345);
  });
});

describe('toggle', () => {
  it('flips done for matching id only', () => {
    const result = toggle(fixture(), '1');
    expect(result[0].done).toBe(true);
    expect(result[1].done).toBe(true);
    expect(result[2].done).toBe(false);
  });
});

describe('remove', () => {
  it('drops the matching todo', () => {
    expect(remove(fixture(), '2')).toHaveLength(2);
    expect(remove(fixture(), '2').map((t) => t.id)).toEqual(['1', '3']);
  });
});

describe('rename', () => {
  it('updates text when non-empty', () => {
    const result = rename(fixture(), '1', '  ny  ');
    expect(result[0].text).toBe('ny');
  });

  it('removes when text becomes empty', () => {
    const result = rename(fixture(), '1', '   ');
    expect(result.find((t) => t.id === '1')).toBeUndefined();
  });
});

describe('setAssignee', () => {
  it('updates assignee', () => {
    const result = setAssignee(fixture(), '1', 'p2');
    expect(result[0].assignedTo).toBe('p2');
  });

  it('clears assignee with null', () => {
    const result = setAssignee(fixture(), '2', null);
    expect(result[1].assignedTo).toBeNull();
  });
});

describe('setDueAt', () => {
  it('updates due date', () => {
    const result = setDueAt(fixture(), '1', 5000);
    expect(result[0].dueAt).toBe(5000);
  });

  it('clears due date with null', () => {
    const result = setDueAt(fixture(), '2', null);
    expect(result[1].dueAt).toBeNull();
  });
});

describe('clearAssignee', () => {
  it('nulls assignee for everyone matching the person', () => {
    const result = clearAssignee(fixture(), 'p1');
    expect(result[0].assignedTo).toBeNull();
    expect(result[1].assignedTo).toBe('p2');
    expect(result[2].assignedTo).toBeNull();
  });
});

describe('clearDone', () => {
  it('keeps only active todos', () => {
    expect(clearDone(fixture()).map((t) => t.id)).toEqual(['1', '3']);
  });
});

describe('applyFilter', () => {
  it.each([
    ['all', ['1', '2', '3']],
    ['active', ['1', '3']],
    ['done', ['2']],
  ] as const)('filter=%s', (filter, expected) => {
    expect(applyFilter(fixture(), filter).map((t) => t.id)).toEqual(expected);
  });
});
