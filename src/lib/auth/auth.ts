// src/lib/auth/auth.ts
// ⚠️  Import depuis @/lib/supabase/server — NE PAS changer vers infra/
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

  // ✅ Même client que le middleware — cookies cohérents
  const supabase = createSupabaseServer({ cookies: context.cookies, request: context.request })

  // ✅ getUser() uniquement — pas de getSession() avant (évite double appel réseau)
  let user: User
  try {
    const { data: { user: u }, error } = await withTimeout(
      supabase.auth.getUser(), 5000, 'getUser'
    )
    if (error || !u) return authErr(error?.message ?? 'Unauthorized', 401)
    user = u
  } catch (e) {
    return authErr(e instanceof Error ? e.message : 'Auth timeout', 503)
  }

  // Session — lue depuis le cookie local, pas d'appel réseau
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return authErr('No active session', 401)

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

  let planLimits: PlanLimit | null = null
  try {
    const { data } = await withTimeout(
      supabase.from('plan_limits').select('*').eq('plan', profile.plan).single(),
      3000, 'getPlanLimits'
    )
    planLimits = data ?? null
  } catch (e) {
    console.error('[withAuth] planLimits fetch failed:', e instanceof Error ? e.message : String(e))
  }

  return ok({ user, session, profile, planLimits })
}

export type AuthOnlyResult = Result<{ user: User; session: Session }, AuthError>

export async function withAuthOnly(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthOnlyResult> {
  const supabase = createSupabaseServer(context)

  try {
    const { data: { user }, error } = await withTimeout(
      supabase.auth.getUser(), 5000, 'getUser'
    )
    if (error || !user) return authErr(error?.message ?? 'Unauthorized', 401)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return authErr('No session', 401)
    return ok({ user, session })
  } catch (e) {
    return authErr(e instanceof Error ? e.message : 'Timeout', 503)
  }
}