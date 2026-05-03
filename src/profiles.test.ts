import { describe, expect, it } from 'vitest';
import { findProfile, profileLabel } from './profiles';
import type { Profile } from './types';

const profiles: Profile[] = [
  { id: '1', displayName: 'Anna', isAdmin: true },
  { id: '2', displayName: '', isAdmin: false },
];

describe('findProfile', () => {
  it('returns matching profile', () => {
    expect(findProfile(profiles, '1')?.displayName).toBe('Anna');
  });

  it('returns undefined for missing id', () => {
    expect(findProfile(profiles, 'x')).toBeUndefined();
  });

  it('returns undefined for null id', () => {
    expect(findProfile(profiles, null)).toBeUndefined();
  });
});

describe('profileLabel', () => {
  it('returns display name when set', () => {
    expect(profileLabel(profiles[0])).toBe('Anna');
  });

  it('falls back to id prefix when display name is empty', () => {
    expect(profileLabel(profiles[1])).toBe('2');
  });

  it('returns (borttagen) for undefined profile', () => {
    expect(profileLabel(undefined)).toBe('(borttagen)');
  });
});
