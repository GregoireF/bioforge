import type { Database } from '@/lib/infra/supabase/database.types'
import {
  type Supabase, type Result,
  handleSingle,
  normalizeError, logError, isValidUUID, getCurrentIso, dbPayload,
} from './utils'
import { ok, err } from '@/lib/core/result'
 
// ─── Types ────────────────────────────────────────────────────────────────────
export type Profile       = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-z0-9_]{3,24}$/
function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && USERNAME_RE.test(value.trim())
}
 
// ─── Queries ──────────────────────────────────────────────────────────────────
export async function getProfile(
  db: Supabase,
  userId: string
): Promise<Result<Profile, Error>> {
  if (!isValidUUID(userId)) return err(new Error('Invalid user ID'))
 
  try {
    return handleSingle(
      await db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single(),
      'Profile not found'
    )
  } catch (e) {
    logError('getProfile', e, { userId })
    return err(normalizeError(e))
  }
}
 
export async function getProfileByUsername(
  db: Supabase,
  username: string
): Promise<Result<Profile, Error>> {
  if (!isValidUsername(username)) return err(new Error('Invalid username'))
 
  try {
    return handleSingle(
      await db
        .from('profiles')
        .select('*')
        .eq('username', username.trim())
        .eq('is_active', true)
        .is('deleted_at', null)
        .single(),
      'Profile not found'
    )
  } catch (e) {
    logError('getProfileByUsername', e, { username })
    return err(normalizeError(e))
  }
}
 
export async function createProfile(
  db: Supabase,
  profile: ProfileInsert
): Promise<Result<Profile, Error>> {
  if (!profile.id || !profile.username)
    return err(new Error('ID and username are required'))
 
  try {
    return handleSingle(
      await db
        .from('profiles')
        .insert(dbPayload(profile))
        .select()
        .single(),
      'Profile creation failed'
    )
  } catch (e) {
    logError('createProfile', e, { username: profile.username })
    return err(normalizeError(e))
  }
}
 
export async function updateProfile(
  db: Supabase,
  userId: string,
  updates: ProfileUpdate
): Promise<Result<Profile, Error>> {
  if (!isValidUUID(userId)) return err(new Error('Invalid user ID'))
 
  try {
    return handleSingle(
      await db
        .from('profiles')
        .update(dbPayload({ ...updates, updated_at: getCurrentIso() }))
        .eq('id', userId)
        .select()
        .single(),
      'Profile not found'
    )
  } catch (e) {
    logError('updateProfile', e, { userId, fields: Object.keys(updates) })
    return err(normalizeError(e))
  }
}
 
export async function softDeleteProfile(
  db: Supabase,
  userId: string
): Promise<Result<void, Error>> {
  if (!isValidUUID(userId)) return err(new Error('Invalid user ID'))
 
  try {
    const { error } = await db
      .from('profiles')
      .update(dbPayload({ deleted_at: getCurrentIso(), is_active: false }))
      .eq('id', userId)
 
    if (error) return err(new Error(error.message))
    return ok(undefined as void)
  } catch (e) {
    logError('softDeleteProfile', e, { userId })
    return err(normalizeError(e))
  }
}
 
export async function checkUsernameAvailable(
  db: Supabase,
  username: string
): Promise<Result<boolean, Error>> {
  if (!isValidUsername(username)) return err(new Error('Invalid username'))
 
  try {
    const { data, error } = await db
      .from('profiles')
      .select('username')
      .eq('username', username.trim())
      .maybeSingle()
 
    if (error) return err(new Error(error.message))
    return ok(data === null)
  } catch (e) {
    logError('checkUsernameAvailable', e, { username })
    return err(normalizeError(e))
  }
}