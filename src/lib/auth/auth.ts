// src/lib/auth/auth.ts
// Logique originale inchangée — seul le format de retour change :
// { success: true, data: {} } → ok({}) pour wrapApiHandler (lit .value)
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

function authErr(message: string, statusCode: number, redirect = '/signin'): AuthResult {
  return err({ message, statusCode, redirect })
}

export async function withAuth(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthResult> {

  const supabase = createSupabaseServer({ cookies: context.cookies, request: context.request })

  // 1. Session (inchangé)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user)
    return authErr(sessionError?.message ?? 'Aucune session valide', 401)

  // 2. Validation stricte (inchangé)
  const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser()
  if (userError || !validatedUser)
    return authErr(userError?.message ?? 'Utilisateur invalide', 401)

  // 3. Profil (inchangé)
  const profileResult = await getProfile(validatedUser.id)
  if (!profileResult.success || !profileResult.data)
    return authErr(profileResult.message ?? 'Profil introuvable', 404)

  const profile = profileResult.data as unknown as Profile

  // 4. Plan limits (inchangé)
  let planLimits: PlanLimit | null = null
  try {
    const limitsResult = await getProfileWithPlanLimits(validatedUser.id)
    if (limitsResult.success) planLimits = limitsResult.data as unknown as PlanLimit
  } catch (e) {
    console.warn('[withAuth] planLimits failed:', e instanceof Error ? e.message : String(e))
  }

  // ✅ Seul changement : ok() au lieu de { success: true, data: {} }
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
  if (userError || !user)
    return authErr(userError?.message ?? 'Invalid token', 401)

  return ok({ user, session })
}