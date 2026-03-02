import { atom, computed } from 'nanostores';
import type { Database } from '@/lib/supabase/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type PlanLimit = Database['public']['Tables']['plan_limits']['Row'];

// ==================== STORES ====================

export const $profile = atom<Profile | null>(null);
export const $planLimits = atom<PlanLimit | null>(null);
export const $profileLoading = atom<boolean>(false);
export const $profileError = atom<string | null>(null);

// ==================== COMPUTED ====================

export const $isPremium = computed($profile, (profile) => {
  return profile?.plan !== 'Free';
});

export const $canUpgrade = computed($profile, (profile) => {
  return profile?.plan === 'Free' || profile?.plan === 'Creator';
});

export const $usagePercentage = computed(
  [$profile, $planLimits],
  (profile, limits) => {
    if (!profile || !limits) return 0;
    // This would need actual block count - integrate with blocks store
    return 0;
  }
);

// ==================== ACTIONS ====================

export function setProfile(profile: Profile | null) {
  $profile.set(profile);
}

export function setPlanLimits(limits: PlanLimit | null) {
  $planLimits.set(limits);
}

export function updateProfile(updates: Partial<Profile>) {
  const current = $profile.get();
  if (current) {
    $profile.set({ ...current, ...updates });
  }
}

export async function fetchProfile() {
  $profileLoading.set(true);
  $profileError.set(null);

  try {
    const response = await fetch('/api/profile');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch profile');
    }

    setProfile(data.profile);
  } catch (error) {
    $profileError.set(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    $profileLoading.set(false);
  }
}

export async function updateProfileOptimistic(updates: Partial<Profile>) {
  const previous = $profile.get();
  if (!previous) return;

  // Optimistic update
  updateProfile(updates);

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }

    setProfile(data.profile);
    return data.profile;
  } catch (error) {
    // Rollback
    setProfile(previous);
    throw error;
  }
}