import type { Profile } from './types';

export function findProfile(
  profiles: Profile[],
  id: string | null,
): Profile | undefined {
  if (id === null) return undefined;
  return profiles.find((p) => p.id === id);
}

export function profileLabel(profile: Profile | undefined): string {
  if (!profile) return '(borttagen)';
  return profile.displayName.trim() || profile.id.slice(0, 8);
}
