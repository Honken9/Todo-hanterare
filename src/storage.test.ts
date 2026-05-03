import { beforeEach, describe, expect, it } from 'vitest';
import { loadMe, saveMe } from './storage';

beforeEach(() => {
  localStorage.clear();
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

  it('returns null on malformed JSON', () => {
    localStorage.setItem('todo-hanterare:me:v1', 'not json');
    expect(loadMe()).toBeNull();
  });
});
