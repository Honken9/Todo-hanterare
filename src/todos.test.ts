import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  archive,
  archiveDone,
  cloneAsActive,
  clearAssignee,
  createTodo,
  remove,
  rename,
  setAssignee,
  setDueAt,
  toggle,
  unarchive,
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
      archivedAt: null,
    },
    {
      id: '2',
      text: 'b',
      done: true,
      createdAt: 2,
      createdBy: 'p1',
      assignedTo: 'p2',
      dueAt: 1000,
      archivedAt: null,
    },
    {
      id: '3',
      text: 'c',
      done: false,
      createdAt: 3,
      createdBy: 'p2',
      assignedTo: null,
      dueAt: null,
      archivedAt: null,
    },
    {
      id: '4',
      text: 'd',
      done: true,
      createdAt: 4,
      createdBy: 'p1',
      assignedTo: 'p1',
      dueAt: null,
      archivedAt: 5000,
    },
  ];
}

describe('createTodo', () => {
  it('trims text and starts not done, not archived', () => {
    const t = createTodo({ text: '  hej  ', createdBy: 'p1' });
    expect(t.text).toBe('hej');
    expect(t.done).toBe(false);
    expect(t.archivedAt).toBeNull();
    expect(t.createdBy).toBe('p1');
  });
});

describe('toggle', () => {
  it('flips done', () => {
    expect(toggle(fixture(), '1')[0].done).toBe(true);
  });
});

describe('remove', () => {
  it('drops the matching todo', () => {
    expect(remove(fixture(), '2').map((t) => t.id)).toEqual(['1', '3', '4']);
  });
});

describe('rename', () => {
  it('updates text when non-empty', () => {
    expect(rename(fixture(), '1', 'ny')[0].text).toBe('ny');
  });

  it('removes when text becomes empty', () => {
    expect(rename(fixture(), '1', '   ').find((t) => t.id === '1')).toBeUndefined();
  });
});

describe('setAssignee / setDueAt', () => {
  it('updates assignee', () => {
    expect(setAssignee(fixture(), '1', 'p2')[0].assignedTo).toBe('p2');
  });

  it('updates due date', () => {
    expect(setDueAt(fixture(), '1', 5000)[0].dueAt).toBe(5000);
  });
});

describe('clearAssignee', () => {
  it('nulls assignee for everyone matching the person', () => {
    const result = clearAssignee(fixture(), 'p1');
    expect(result[0].assignedTo).toBeNull();
    expect(result[1].assignedTo).toBe('p2');
    expect(result[3].assignedTo).toBeNull();
  });
});

describe('archive / unarchive', () => {
  it('archive sets archivedAt and forces done', () => {
    const result = archive(fixture(), '1', 9999);
    expect(result[0].archivedAt).toBe(9999);
    expect(result[0].done).toBe(true);
  });

  it('unarchive clears archivedAt and resets done', () => {
    const result = unarchive(fixture(), '4');
    expect(result[3].archivedAt).toBeNull();
    expect(result[3].done).toBe(false);
  });
});

describe('archiveDone', () => {
  it('archives every done todo that is not yet archived', () => {
    const result = archiveDone(fixture(), 9999);
    expect(result[0].archivedAt).toBeNull();
    expect(result[1].archivedAt).toBe(9999);
    expect(result[2].archivedAt).toBeNull();
    expect(result[3].archivedAt).toBe(5000);
  });
});

describe('cloneAsActive', () => {
  it('creates a new active todo with copied text and assignee', () => {
    const source = fixture()[3];
    const clone = cloneAsActive(source, 'p2');
    expect(clone.id).not.toBe(source.id);
    expect(clone.text).toBe(source.text);
    expect(clone.assignedTo).toBe(source.assignedTo);
    expect(clone.createdBy).toBe('p2');
    expect(clone.done).toBe(false);
    expect(clone.archivedAt).toBeNull();
    expect(clone.dueAt).toBeNull();
  });
});

describe('applyFilter', () => {
  it.each([
    ['all', ['1', '2', '3']],
    ['active', ['1', '3']],
    ['done', ['2']],
    ['archive', ['4']],
  ] as const)('filter=%s', (filter, expected) => {
    expect(applyFilter(fixture(), filter).map((t) => t.id)).toEqual(expected);
  });
});
