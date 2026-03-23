// src/lib/auth/auth.ts
// Format de retour : Result<AuthData, AuthError> — auth.value (pas auth.data)
import { createSupabaseServer }    from '@/lib/infra/supabase/server'
import { getProfile, getProfileWithPlanLimits } from '@/lib/supabase/queries'
import { ok, err }                 from '@/lib/core/result'
import type { Result }             from '@/lib/core/result'
import type { Profile, PlanLimit } from '@/lib/db'
import type { User, Session }      from '@supabase/supabase-js'
import type { AstroCookies }       from 'astro'

export interface AuthData {
  user:       User
  session:    Session
  profile:    Profile
  planLimits: PlanLimit | null
}

export type AuthError = {
  message:    string
  statusCode: number
  redirect:   string
}

export type AuthResult = Result<AuthData, AuthError>

function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[withAuth] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ])
}

function authErr(message: string, statusCode: number, redirect = '/signin'): AuthResult {
  return err({ message, statusCode, redirect })
}

export async function withAuth(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthResult> {

  const supabase = createSupabaseServer({ cookies: context.cookies, request: context.request })

  // 1. Session locale (ton code original qui fonctionnait)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user)
    return authErr(sessionError?.message ?? 'No active session', 401)

  const user = session.user

  // 2. Validation stricte (ton code original)
  const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser()
  if (userError || !validatedUser)
    return authErr(userError?.message ?? 'Invalid user', 401)

  // 3. Profil (via tes queries existantes qui fonctionnent)
  const profileResult = await getProfile(validatedUser.id)
  if (!profileResult.success || !profileResult.data)
    return authErr(profileResult.message ?? 'Profile not found', 404)

  const profile = profileResult.data as unknown as Profile

  // 4. Plan limits (non bloquant)
  let planLimits: PlanLimit | null = null
  try {
    const limitsResult = await getProfileWithPlanLimits(validatedUser.id)
    if (limitsResult.success) planLimits = limitsResult.data as unknown as PlanLimit
  } catch (e) {
    console.warn('[withAuth] planLimits failed:', e instanceof Error ? e.message : String(e))
  }

  // ✅ ok() — compatible avec wrapApiHandler qui lit auth.value
  return ok({ user: validatedUser, session, profile, planLimits })
}

export type AuthOnlyResult = Result<{ user: User; session: Session }, AuthError>

export async function withAuthOnly(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthOnlyResult> {
  const supabase = createSupabaseServer(context)

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user)
    return authErr(sessionError?.message ?? 'No session', 401)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return authErr(userError?.message ?? 'Invalid token', 401)

  return ok({ user, session })
}