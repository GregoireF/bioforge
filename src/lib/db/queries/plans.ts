import type { Database } from '@/lib/infra/supabase/database.types'
import {
  type Supabase, type Result,
  handleSingle, handleArray,
  normalizeError, logError,
} from './utils'
 
// ─── Types ────────────────────────────────────────────────────────────────────
 
export type PlanLimit = Database['public']['Tables']['plan_limits']['Row']
export type Plan = 'Free' | 'Creator' | 'Pro' | 'Enterprise'
 
// ─── Constantes ───────────────────────────────────────────────────────────────
export const PLANS         = ['Free', 'Creator', 'Pro', 'Enterprise'] as const satisfies readonly Plan[]
export const PAID_PLANS    = ['Creator', 'Pro', 'Enterprise']           as const satisfies readonly Plan[]
export const PREMIUM_PLANS = ['Pro', 'Enterprise']                       as const satisfies readonly Plan[]
 
// ─── Type Guards & Helpers ────────────────────────────────────────────────────
export function isValidPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as readonly string[]).includes(value)
}
 
export function isPaidPlan(plan: Plan): boolean {
  return (PAID_PLANS as readonly string[]).includes(plan)
}
 
export function isPremiumPlan(plan: Plan): boolean {
  return (PREMIUM_PLANS as readonly string[]).includes(plan)
}
 
// Free + Creator voient des ads, Pro + Enterprise non
export function shouldShowAds(plan: Plan): boolean {
  return !isPremiumPlan(plan)
}
 
// ─── Queries ──────────────────────────────────────────────────────────────────
export async function getPlanLimits(
  db: Supabase,
  plan: Plan
): Promise<Result<PlanLimit>> {
  try {
    return handleSingle(
      await db
        .from('plan_limits')
        .select('*')
        .eq('plan', plan)
        .maybeSingle(),
      `Plan limits not found for: ${plan}`
    )
  } catch (err) {
    logError('getPlanLimits', err, { plan })
    return { success: false, error: normalizeError(err) }
  }
}
 
export async function getAllPlanLimits(
  db: Supabase
): Promise<Result<PlanLimit[]>> {
  try {
    return handleArray(
      await db
        .from('plan_limits')
        .select('*')
        .order('monthly_price_cents', { ascending: true })
    )
  } catch (err) {
    logError('getAllPlanLimits', err)
    return { success: false, error: normalizeError(err) }
  }
}