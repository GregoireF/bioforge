// ─── Utils ────────────────────────────────────────────────────────────────────
export type { Result, Supabase }                    from './queries/utils'
export { isValidUUID, getCurrentIso, dbPayload, toJson } from './queries/utils'

// ─── Core (re-export pour usage direct depuis @/lib/db) ───────────────────────
export { ok, err, isOk, isErr }                     from '@/lib/core/result'
export type { Ok, Err }                             from '@/lib/core/result'

// ─── Profiles ─────────────────────────────────────────────────────────────────
export type { Profile, ProfileInsert, ProfileUpdate } from './queries/profiles'
export {
  getProfile, getProfileByUsername,
  createProfile, updateProfile,
  softDeleteProfile, checkUsernameAvailable,
} from './queries/profiles'

// ─── Blocks ───────────────────────────────────────────────────────────────────
export type { Block, BlockInsert, BlockUpdate, ReorderError } from './queries/blocks'
export {
  getBlocks, getActiveBlocks,
  createBlock, updateBlock,
  softDeleteBlock, reorderBlocks,
} from './queries/blocks'

// ─── Plans ────────────────────────────────────────────────────────────────────
export type { PlanLimit, Plan }                     from './queries/plans'
export {
  PLANS, PAID_PLANS, PREMIUM_PLANS,
  isValidPlan, isPaidPlan, isPremiumPlan, shouldShowAds,
  getPlanLimits, getAllPlanLimits,
} from './queries/plans'

// ─── Analytics ────────────────────────────────────────────────────────────────
export type { TopBlock, AnalyticsSummary, CreatorDashboard, FullAnalytics } from './queries/analytics'
export {
  getProfileStats, getBlockStats,
  getAnalyticsSummary, getCreatorDashboard,
  getFullAnalytics,
  incrementProfileView, incrementBlockClick,
} from './queries/analytics'