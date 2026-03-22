export type Plan = 'Free' | 'Creator' | 'Pro' | 'Enterprise'

export const PLANS         = ['Free', 'Creator', 'Pro', 'Enterprise'] as const satisfies readonly Plan[]
export const PAID_PLANS    = ['Creator', 'Pro', 'Enterprise']          as const satisfies readonly Plan[]
export const PREMIUM_PLANS = ['Pro', 'Enterprise']                     as const satisfies readonly Plan[]

export function isPaidPlan(plan: Plan): boolean {
  return (PAID_PLANS as readonly string[]).includes(plan)
}

export function isPremiumPlan(plan: Plan): boolean {
  return (PREMIUM_PLANS as readonly string[]).includes(plan)
}

export function shouldShowAds(plan: Plan): boolean {
  return !isPremiumPlan(plan)
}

export function isValidPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as readonly string[]).includes(value)
}