import { describe, expect, it } from 'vitest';
import { createPerson, findPerson, removePerson } from './people';

describe('createPerson', () => {
  it('trims name and assigns id', () => {
    const p = createPerson('  Anna  ');
    expect(p.name).toBe('Anna');
    expect(p.id).toBeTruthy();
  });
});

describe('removePerson', () => {
  it('drops the matching person', () => {
    const people = [
      { id: '1', name: 'Anna' },
      { id: '2', name: 'Björn' },
    ];
    expect(removePerson(people, '1')).toEqual([{ id: '2', name: 'Björn' }]);
  });
});

describe('findPerson', () => {
  const people = [{ id: '1', name: 'Anna' }];

  it('returns matching person', () => {
    expect(findPerson(people, '1')?.name).toBe('Anna');
  });

  it('returns undefined for missing id', () => {
    expect(findPerson(people, 'x')).toBeUndefined();
  });

  it('returns undefined for null id', () => {
    expect(findPerson(people, null)).toBeUndefined();
  });
});
