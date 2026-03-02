import type { AstroCookies, APIContext } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { getProfile, getPlanLimits, getBlocks, type Result } from '@/lib/supabase/queries'

// ---------------- TYPES ----------------
export interface MiddlewareContext {
  user: any
  profile: any
  planLimits: any
  cookies: AstroCookies
}

export interface PlanCheckOptions {
  feature: 'blocks' | 'analytics' | 'customization' | 'api'
  action?: 'create' | 'read' | 'update' | 'delete'
  currentUsage?: number
}

export interface MiddlewareResult<T = any> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
  redirect?: string
}

// ---------------- FEATURE MATRIX ----------------
const FEATURE_MATRIX: Record<string, string[]> = {
  blocks: ['Free', 'Creator', 'Pro', 'Enterprise'],
  analytics: ['Free', 'Creator', 'Pro', 'Enterprise'],
  customization: ['Creator', 'Pro', 'Enterprise'],
  api: ['Pro', 'Enterprise'],
  webhooks: ['Enterprise'],
  whitelabel: ['Enterprise'],
  priority_support: ['Pro', 'Enterprise'],
  custom_domain: ['Pro', 'Enterprise']
}

function hasFeatureAccess(plan: string, feature: string) {
  return FEATURE_MATRIX[feature]?.includes(plan) ?? false
}

// ---------------- AUTH ----------------
export async function withAuth(context: APIContext): Promise<MiddlewareResult<MiddlewareContext>> {
  try {
    const user = await requireUser(context)
    if (!user) return { success: false, error: 'Authentication required', statusCode: 401, redirect: '/signin' }

    const profileRes = await getProfile(user.id)
    if (!profileRes.success) return { success: false, error: profileRes.error.message, statusCode: 404 }

    const planLimitsRes = await getPlanLimits(profileRes.data.plan)
    if (!planLimitsRes.success) return { success: false, error: planLimitsRes.error.message, statusCode: 500 }

    return {
      success: true,
      data: { user, profile: profileRes.data, planLimits: planLimitsRes.data, cookies: context.cookies }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Authentication failed', statusCode: 401 }
  }
}

// ---------------- PLAN LIMITS ----------------
export async function checkPlanLimits(context: MiddlewareContext, options: PlanCheckOptions): Promise<MiddlewareResult<{ allowed: boolean; usage?: any; requiresUpgrade?: boolean; feature?: string; currentPlan?: string }>> {
  const { profile, planLimits } = context
  const { feature, action = 'create', currentUsage } = options

  if (!hasFeatureAccess(profile.plan, feature)) {
    return {
      success: false,
      error: `Your ${profile.plan} plan doesn't include ${feature}`,
      statusCode: 403,
      data: { allowed: false, requiresUpgrade: true, feature, currentPlan: profile.plan }
    }
  }

  if (feature === 'blocks' && action === 'create') {
    let usage = currentUsage
    if (usage === undefined) {
      const blocksRes = await getBlocks(profile.id)
      if (!blocksRes.success) return { success: false, error: 'Failed to fetch blocks', statusCode: 500 }
      usage = blocksRes.data.length
    }

    const limit = planLimits.max_blocks_total
    if (limit !== -1 && usage >= limit) {
      return {
        success: false,
        error: `Block limit reached (${limit})`,
        statusCode: 403,
        data: { allowed: false, usage: { current: usage, limit, percentage: 100 } }
      }
    }

    const percentage = limit === -1 ? 0 : (usage / limit) * 100
    return { success: true, data: { allowed: true, usage: { current: usage, limit: limit === -1 ? 'Unlimited' : limit, percentage } } }
  }

  return { success: true, data: { allowed: true } }
}

// ---------------- COMBINED ----------------
export async function withAuthAndLimits(
  context: APIContext,
  checkOptions?: PlanCheckOptions
): Promise<MiddlewareResult<MiddlewareContext & { canProceed: boolean; usage?: any }>> {
  const auth = await withAuth(context)
  if (!auth.success || !auth.data) return { ...auth, data: auth.data ? { ...auth.data, canProceed: false } : undefined }

  if (!checkOptions) return { success: true, data: { ...auth.data, canProceed: true } }

  const limits = await checkPlanLimits(auth.data, checkOptions)
  if (!limits.success) {
    return { ...limits, data: { ...auth.data, canProceed: false, usage: limits.data?.usage } }
  }

  return { success: true, data: { ...auth.data, canProceed: limits.data?.allowed || false, usage: limits.data?.usage } }
}

// ---------------- HELPER ----------------
export function toMiddlewareResult<T>(result: Result<T>, statusCode = 500): MiddlewareResult<T> {
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error.message, statusCode }
}