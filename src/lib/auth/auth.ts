// src/lib/auth/auth.ts
import { createSupabaseServer }    from '@/lib/infra/supabase/server'
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

  // 1. Session locale — pas d'appel réseau
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user)
    return authErr(sessionError?.message ?? 'No active session', 401)

  // 2. Validation JWT côté serveur
  let user: User
  try {
    const { data: { user: u }, error } = await withTimeout(
      supabase.auth.getUser(), 5000, 'getUser'
    )
    if (error || !u) return authErr(error?.message ?? 'Token validation failed', 401)
    user = u
  } catch (e) {
    return authErr(e instanceof Error ? e.message : 'Auth timeout', 503)
  }

  // 3. Profil
  let profile: Profile
  try {
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('*')
        .eq('id', user.id).eq('is_active', true).is('deleted_at', null).single(),
      5000, 'getProfile'
    )
    if (error || !data) return authErr(error?.message ?? 'Profile not found', 404)
    profile = data
  } catch (e) {
    return authErr(e instanceof Error ? e.message : 'Database timeout', 503)
  }

  // 4. Plan limits — non bloquant
  let planLimits: PlanLimit | null = null
  try {
    const { data } = await withTimeout(
      supabase.from('plan_limits').select('*').eq('plan', profile.plan).single(),
      3000, 'getPlanLimits'
    )
    planLimits = data ?? null
  } catch (e) {
    console.warn('[withAuth] planLimits failed:', e instanceof Error ? e.message : String(e))
  }

  // ✅ Retourne ok() — format Result<AuthData, AuthError>
  // wrapApiHandler lit auth.value (pas auth.data)
  return ok({ user, session, profile, planLimits })
}

export type AuthOnlyResult = Result<{ user: User; session: Session }, AuthError>

export async function withAuthOnly(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthOnlyResult> {
  const supabase = createSupabaseServer(context)

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user)
    return authErr(sessionError?.message ?? 'No session', 401)

  try {
    const { data: { user }, error } = await withTimeout(
      supabase.auth.getUser(), 5000, 'getUser'
    )
    if (error || !user) return authErr(error?.message ?? 'Invalid token', 401)
    return ok({ user, session })
  } catch (e) {
    return authErr(e instanceof Error ? e.message : 'Timeout', 503)
  }
}