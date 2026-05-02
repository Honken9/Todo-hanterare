import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  clearDone,
  createTodo,
  remove,
  rename,
  toggle,
} from './todos';
import type { Todo } from './types';

function fixture(): Todo[] {
  return [
    { id: '1', text: 'a', done: false, createdAt: 1 },
    { id: '2', text: 'b', done: true, createdAt: 2 },
    { id: '3', text: 'c', done: false, createdAt: 3 },
  ];
}

describe('createTodo', () => {
  it('trims text and starts not done', () => {
    const t = createTodo('  hej  ');
    expect(t.text).toBe('hej');
    expect(t.done).toBe(false);
    expect(t.id).toBeTruthy();
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
