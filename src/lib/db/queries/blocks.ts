import type { Database } from '@/lib/infra/supabase/database.types'
import {
  type Supabase, type Result,
  handleSingle, handleArray,
  normalizeError, logError, isValidUUID, getCurrentIso, dbPayload,
} from './utils'
import { ok, err } from '@/lib/core/result'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Block       = Database['public']['Tables']['blocks']['Row']
export type BlockInsert = Database['public']['Tables']['blocks']['Insert']
export type BlockUpdate = Database['public']['Tables']['blocks']['Update']

export type ReorderError = { failed: string[]; message: string }

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getBlocks(
  db: Supabase,
  profileId: string
): Promise<Result<Block[], Error>> {
  if (!isValidUUID(profileId))
    return err(new Error('Invalid profile ID'))

  try {
    return handleArray(
      await db
        .from('blocks')
        .select('*')
        .eq('profile_id', profileId)
        .is('deleted_at', null)
        .order('position', { ascending: true })
    )
  } catch (e) {
    logError('getBlocks', e, { profileId })
    return err(normalizeError(e))
  }
}

export async function getActiveBlocks(
  db: Supabase,
  profileId: string
): Promise<Result<Block[], Error>> {
  if (!isValidUUID(profileId))
    return err(new Error('Invalid profile ID'))

  try {
    return handleArray(
      await db
        .from('blocks')
        .select('*')
        .eq('profile_id', profileId)
        .eq('active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
    )
  } catch (e) {
    logError('getActiveBlocks', e, { profileId })
    return err(normalizeError(e))
  }
}

export async function createBlock(
  db: Supabase,
  block: BlockInsert
): Promise<Result<Block, Error>> {
  if (!isValidUUID(block.profile_id ?? ''))
    return err(new Error('Invalid profile ID'))

  try {
    const { data: canAdd, error: rpcError } = await db
      .rpc('can_add_block', { p_profile_id: block.profile_id })

    if (rpcError) return err(new Error(rpcError.message))
    if (!canAdd)  return err(new Error('Block limit reached for your plan'))

    const { data: last } = await db
      .from('blocks')
      .select('position')
      .eq('profile_id', block.profile_id!)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastPos  = last?.position ?? 0
    const position = Math.ceil((lastPos + 1) / 10) * 10

    return handleSingle(
      await db
        .from('blocks')
        .insert(dbPayload({ ...block, config: block.config ?? {}, position }))
        .select()
        .single(),
      'Block creation failed'
    )
  } catch (e) {
    logError('createBlock', e, { profileId: block.profile_id })
    return err(normalizeError(e))
  }
}

export async function updateBlock(
  db: Supabase,
  blockId: string,
  profileId: string,
  updates: BlockUpdate
): Promise<Result<Block, Error>> {
  if (!isValidUUID(blockId))   return err(new Error('Invalid block ID'))
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  try {
    return handleSingle(
      await db
        .from('blocks')
        .update(dbPayload({ ...updates, updated_at: getCurrentIso() }))
        .eq('id', blockId)
        .eq('profile_id', profileId)
        .is('deleted_at', null)
        .select()
        .single(),
      'Block not found'
    )
  } catch (e) {
    logError('updateBlock', e, { blockId, profileId })
    return err(normalizeError(e))
  }
}

export async function softDeleteBlock(
  db: Supabase,
  blockId: string,
  profileId: string
): Promise<Result<void, Error>> {
  if (!isValidUUID(blockId))   return err(new Error('Invalid block ID'))
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  try {
    const { error } = await db
      .from('blocks')
      .update(dbPayload({ deleted_at: getCurrentIso() }))
      .eq('id', blockId)
      .eq('profile_id', profileId)

    if (error) return err(new Error(error.message))
    return ok(undefined as void)
  } catch (e) {
    logError('softDeleteBlock', e, { blockId, profileId })
    return err(normalizeError(e))
  }
}

export async function reorderBlocks(
  db: Supabase,
  blockIds: string[],
  profileId: string
): Promise<Result<void, ReorderError>> {
  if (!blockIds.length) return ok(undefined as void)
  if (!isValidUUID(profileId))
    return err({ failed: [], message: 'Invalid profile ID' })

  try {
    // ✅ Vérifier que tous les blockIds appartiennent au profil AVANT upsert
    // Sans cette vérification, upsert avec onConflict='id' INSÈRE un bloc vide
    // si l'id n'existe pas encore.
    const { data: existing, error: fetchError } = await db
      .from('blocks')
      .select('id')
      .in('id', blockIds)
      .eq('profile_id', profileId)
      .is('deleted_at', null)

    if (fetchError) {
      logError('reorderBlocks.verify', fetchError, { profileId })
      return err({ failed: blockIds, message: fetchError.message })
    }

    const validIds = new Set((existing ?? []).map(b => b.id))
    const invalid  = blockIds.filter(id => !validIds.has(id))
    if (invalid.length > 0) {
      return err({ failed: invalid, message: 'Some blocks not found or not owned by profile' })
    }

    const { error } = await db
      .from('blocks')
      .upsert(
        blockIds.map((id, i) => dbPayload({
          id,
          profile_id: profileId,
          position:   (i + 1) * 10,
          updated_at: getCurrentIso(),
        })),
        { onConflict: 'id' }
      )

    if (error) {
      logError('reorderBlocks', error, { profileId, count: blockIds.length })
      return err({ failed: blockIds, message: error.message })
    }

    return ok(undefined as void)
  } catch (e) {
    logError('reorderBlocks', e, { profileId })
    return err({ failed: blockIds, message: normalizeError(e).message })
  }
}