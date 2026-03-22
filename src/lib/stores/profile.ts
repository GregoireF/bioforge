import { atom } from 'nanostores'
import type { Profile, PlanLimit } from '@/lib/db'

export const $profile    = atom<Profile | null>(null)
export const $planLimits = atom<PlanLimit | null>(null)

export function setProfile(profile: Profile, planLimits: PlanLimit | null = null) {
  $profile.set(profile)
  $planLimits.set(planLimits)
}

export function getCurrentPlan(): string {
  return $profile.get()?.plan ?? 'Free'
}

export function canUseFeature(feature: keyof PlanLimit): boolean {
  const limits = $planLimits.get()
  if (!limits) return false
  return Boolean(limits[feature])
}