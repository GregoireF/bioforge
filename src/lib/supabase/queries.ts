import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { PostgrestError  } from '@supabase/supabase-js'

// ==================== CONST ====================

const MAX_STATS_DAYS = 90
const DEFAULT_STATS_DAYS = 7
const PLAN_CACHE_TTL = 3600_000;

const planCache = new Map<string, CachedPlan>()
let allPlansCache: CachedPlans | null = null

// ==================== TYPES ====================

type CachedPlan = {
  data: PlanLimit
  timestamp: number
}

type CachedPlans = {
  data: PlanLimit[]
  timestamp: number
}

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

type Block = Database['public']['Tables']['blocks']['Row']
export type BlockInsert = Database['public']['Tables']['blocks']['Insert']
export type BlockUpdate = Database['public']['Tables']['blocks']['Update']

type PlanLimit = Database['public']['Tables']['plan_limits']['Row']
type DailyProfileStats = Database['public']['Tables']['daily_profile_stats']['Row']
type DailyBlockStats = Database['public']['Tables']['daily_block_stats']['Row']

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E; message?: string }

export type ProfileWithLimits = Profile & { plan_limits: PlanLimit | null }
export type TopBlock = Block & { clicks: number }

export type AnalyticsSummary = {
  summary: {
    totalViews: number
    totalClicks: number
    clickRate: number
    activeBlocks: number
  }
  profileStats: DailyProfileStats[]
  blockStats: DailyBlockStats[]
  topBlocks: TopBlock[]
}

export type CreatorDashboard = {
  blocks: Block[]
  stats: AnalyticsSummary['summary']
  chartData: {
    labels: string[]
    views: number[]
    clicks: number[]
  }
  topBlocks: TopBlock[]
}

export type ReorderError = {
  failed: string[]
  message: string
}

// ==================== UTILITY ====================

function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  return new Error('Unknown error occurred')
}

function logError(context: string, err: unknown, meta: Record<string, any> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    ctx: context,
    err: err instanceof Error
      ? { name: err.name, msg: err.message, stack: err.stack?.split('\n').slice(0, 6).join('\n') ?? null }
      : err,
    ...meta
  }
  console.error(JSON.stringify(payload, null, 2))
}

function handleSupabaseSingle<T>(
  { data, error }: { data: T | null; error: PostgrestError | null },
  notFoundMsg = 'Resource not found'
): Result<T> {
  if (error) return { success: false, error, message: error.message }
  if (!data) return { success: false, error: new Error(notFoundMsg) }
  return { success: true, data }
}

function handleSupabaseArray<T>(
  { data, error }: { data: T[] | null; error: PostgrestError | null }
): Result<T[]> {
  if (error) return { success: false, error, message: error.message }
  return { success: true, data: data ?? [] }
}

function getCurrentIso(): string {
  return new Date().toISOString()
}

function getStartDate(days: number): string {
  const safeDays = Math.min(Math.max(1, days), MAX_STATS_DAYS)
  const date = new Date()
  date.setDate(date.getDate() - safeDays)
  return date.toISOString().split('T')[0]
}

// ==================== PROFILES ====================

export async function getProfile(userId: string): Promise<Result<Profile>> {
  if (typeof userId !== 'string' || userId.trim().length < 8) {
    return { success: false, error: new Error('Invalid user ID') }
  }

  try {
    const res = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .single()

    return handleSupabaseSingle(res, 'Profile not found')
  } catch (err) {
    logError('getProfile', err, { userId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getProfileByUsername(username: string): Promise<Result<Profile>> {
  if (typeof username !== 'string' || username.trim().length < 3) {
    return { success: false, error: new Error('Invalid username') }
  }

  try {
    const res = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    return handleSupabaseSingle(res, 'Active profile not found')
  } catch (err) {
    logError('getProfileByUsername', err, { username })
    return { success: false, error: normalizeError(err) }
  }
}

export async function createProfile(profile: ProfileInsert): Promise<Result<Profile>> {
  if (!profile.id || !profile.username) {
    return { success: false, error: new Error('ID and username are required') } 
  }

  try {
    const res = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single()

    return handleSupabaseSingle(res, 'Profile creation failed')
  } catch (err) {
    logError('createProfile', err, { username: profile.username })
    return { success: false, error: normalizeError(err) }
  }
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Result<Profile>> {
  if (typeof userId !== 'string' || userId.trim().length < 8) {
    return { success: false, error: new Error('Invalid user ID') }
  }

  try {
    const res = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: getCurrentIso(),
      })
      .eq('id', userId)
      .select()
      .maybeSingle()

    return handleSupabaseSingle(res, 'Profile not found or update failed')
  } catch (err) {
    logError('updateProfile', err, { userId, updatedFields: Object.keys(updates) })
    return { success: false, error: normalizeError(err) }
  }
}

export async function softDeleteProfile(userId: string): Promise<Result<void>> {
  if (typeof userId !== 'string' || userId.trim().length < 8) {
    return { success: false, error: new Error('Invalid user ID') }
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        deleted_at: getCurrentIso(),
        is_active: false
      })
      .eq('id', userId)

    if (error) {
      return { success: false, error, message: error.message }
    }
    return { success: true, data: undefined }
  } catch (err) {
    logError('softDeleteProfile', err, { userId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function checkUsernameAvailable(username: string): Promise<Result<boolean>> {
  if (typeof username !== 'string' || username.trim().length < 3) {
    return { success: false, error: new Error('Invalid username') }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (error) {
      return { success: false, error, message: error.message }
    }
    return { success: true, data: !data }
  } catch (err) {
    logError('checkUsernameAvailable', err, { username })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getProfileWithPlanLimits(userId: string): Promise<Result<ProfileWithLimits>> {
  if (typeof userId !== 'string' || userId.trim().length < 8) {
    return { success: false, error: new Error('Invalid user ID') }
  }

  try {
    const profileRes = await getProfile(userId)
    if (!profileRes.success) return profileRes
    const profile = profileRes.data

    const planRes = await getPlanLimits(profile.plan)
    if (!planRes.success) return planRes

    return {
      success: true,
      data: { ...profile, plan_limits: planRes.data }
    }
  } catch (err) {
    logError('getProfileWithPlanLimits', err, { userId })
    return { success: false, error: normalizeError(err) }
  }
}

// ==================== BLOCKS ====================

export async function getBlocks(profileId: string): Promise<Result<Block[]>> {
  // Garde très permissive mais sûre
  if (!profileId || typeof profileId !== 'string' || profileId.trim().length < 10) {
    console.warn('[getBlocks] ID invalide ou vide → retour tableau vide', { profileId });
    return { success: true, data: [] }; // ← on retourne vide au lieu d'erreur
  }

  try {
    const res = await supabase
      .from('blocks')
      .select('*')
      .eq('profile_id', profileId.trim()) // trim pour être sûr
      .order('position', { ascending: true });

    return handleSupabaseArray(res);
  } catch (err) {
    logError('getBlocks', err, { profileId });
    return { success: false, error: normalizeError(err) };
  }
}

export async function getActiveBlocks(profileId: string): Promise<Result<Block[]>> {
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return { success: false, error: new Error('Invalid profile ID') }
  }

  try {
    const res = await supabase
      .from('blocks')
      .select('*')
      .eq('profile_id', profileId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('position', { ascending: true })

    return handleSupabaseArray(res)
  } catch (err) {
    logError('getActiveBlocks', err, { profileId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getBlock(blockId: string): Promise<Result<Block>> {
  if (typeof blockId !== 'string' || blockId.trim() === '') {
    return { success: false, error: new Error('Invalid block ID') }
  }

  try {
    const res = await supabase
      .from('blocks')
      .select('*')
      .eq('id', blockId)
      .is('deleted_at', null)
      .single()

    return handleSupabaseSingle(res, 'Block not found')
  } catch (err) {
    logError('getBlock', err, { blockId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function createBlock(block: BlockInsert): Promise<Result<Block>> {
  if (!block.profile_id) {
    return { success: false, error: new Error('Profile ID is required') }
  }

  try {
    const canAdd = await canAddBlock(block.profile_id)
    if (!canAdd.success) return canAdd
    if (!canAdd.data) {
      return { success: false, error: new Error('Block limit reached for your plan') }
    }

    const blocksRes = await getBlocks(block.profile_id)
    if (!blocksRes.success) return blocksRes
    const maxPosition = blocksRes.data.length > 0 ? Math.max(...blocksRes.data.map(b => b.position)) : -1

    const res = await supabase
      .from('blocks')
      .insert({ ...block, config: block.config ?? {}, position: maxPosition + 1 })
      .select()
      .single()

    return handleSupabaseSingle(res, 'Block creation failed')
  } catch (err) {
    logError('createBlock', err, { profileId: block.profile_id })
    return { success: false, error: normalizeError(err) }
  }
}

export async function updateBlock(blockId: string, updates: BlockUpdate): Promise<Result<Block>> {
  if (typeof blockId !== 'string' || blockId.trim() === '') {
    return { success: false, error: new Error('Invalid block ID') }
  }

  try {
    const res = await supabase
      .from('blocks')
      .update({ ...updates, updated_at: getCurrentIso() })
      .eq('id', blockId)
      .select()
      .single()

    return handleSupabaseSingle(res, 'Block not found')
  } catch (err) {
    logError('updateBlock', err, { blockId, updatedFields: Object.keys(updates) })
    return { success: false, error: normalizeError(err) }
  }
}

export async function deleteBlock(blockId: string): Promise<Result<void>> {
  if (typeof blockId !== 'string' || blockId.trim() === '') {
    return { success: false, error: new Error('Invalid block ID') }
  }

  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('id', blockId)

    if (error) return { success: false, error, message: error.message }
    return { success: true, data: undefined }
  } catch (err) {
    logError('deleteBlock', err, { blockId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function reorderBlocks(
  blockIds: string[],
  profileId: string
): Promise<Result<void, ReorderError>> {
  if (!Array.isArray(blockIds) || blockIds.length === 0) {
    return { success: true, data: undefined }
  }

  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return {
      success: false,
      error: {
        failed: [],
        message: 'Invalid profile ID'
      }
    }
  }
  
  try {
    const updates = blockIds.map((id, index) =>
      supabase
        .from('blocks')
        .update({ position: index })
        .eq('id', id)
        .eq('profile_id', profileId)
    )

    const settled = await Promise.allSettled(updates)
    const failed = settled
      .map((r, i) => (r.status === 'rejected' ? blockIds[i] : null))
      .filter((id): id is string => id !== null)

    if (failed.length > 0) {
      logError('reorderBlocks', 'Partial failure', { failedCount: failed.length, profileId })
      return {
        success: false,
        error: {
          failed,
          message: `${failed.length}/${blockIds.length} blocks failed to reorder`,
        },
      }
    }

    return { success: true, data: undefined }
  } catch (err) {
    logError('reorderBlocks', err, { profileId, blockCount: blockIds.length })
    return { success: false, error: { failed: blockIds, message: normalizeError(err).message } }
  }
}

// ==================== STATS ====================

export async function getProfileStats(profileId: string, days = DEFAULT_STATS_DAYS): Promise<Result<DailyProfileStats[]>> {
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return { success: false, error: new Error('Invalid profile ID') }
  }

  if (days < 1 || days > MAX_STATS_DAYS) {
    return { success: false, error: new Error(`Days must be between 1 and ${MAX_STATS_DAYS}`) }
  }

  const safeDays = Math.min(days, MAX_STATS_DAYS)

  try {
    const res = await supabase
      .from('daily_profile_stats')
      .select('*')
      .eq('profile_id', profileId)
      .gte('date', getStartDate(safeDays))
      .order('date', { ascending: true })

    return handleSupabaseArray(res)
  } catch (err) {
    logError('getProfileStats', err, { profileId, days: safeDays })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getBlockStats(blockIds: string[], days = DEFAULT_STATS_DAYS): Promise<Result<DailyBlockStats[]>> {
  if (blockIds.length === 0) return { success: true, data: [] }

  if (days < 1 || days > MAX_STATS_DAYS) {
    return { success: false, error: new Error(`Days must be between 1 and ${MAX_STATS_DAYS}`) }
  }

  const safeDays = Math.min(days, MAX_STATS_DAYS)

  try {
    const res = await supabase
      .from('daily_block_stats')
      .select('*')
      .in('block_id', blockIds)
      .gte('date', getStartDate(safeDays))
      .order('date', { ascending: true })

    return handleSupabaseArray(res)
  } catch (err) {
    logError('getBlockStats', err, { blockCount: blockIds.length, days: safeDays })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getAnalyticsSummary(profileId: string, days = DEFAULT_STATS_DAYS): Promise<Result<AnalyticsSummary>> {
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return { success: false, error: new Error('Invalid profile ID') }
  }

  try {
    const [statsRes, blocksRes] = await Promise.all([
      getProfileStats(profileId, days),
      getBlocks(profileId)
    ])

    if (!statsRes.success) return statsRes
    if (!blocksRes.success) return blocksRes

    const profileStats = statsRes.data
    const blocks = blocksRes.data

    const blockIds = blocks.map(b => b.id)
    const blockStatsRes = await getBlockStats(blockIds, days)
    if (!blockStatsRes.success) return blockStatsRes
    const blockStats = blockStatsRes.data

    const totalViews = profileStats.reduce((sum, s) => sum + s.views, 0)
    const totalClicks = blockStats.reduce((sum, s) => sum + s.clicks, 0)
    const clickRate = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0

    const blockClicksMap = new Map<string, number>()
    blockStats.forEach(s => {
      blockClicksMap.set(s.block_id, (blockClicksMap.get(s.block_id) ?? 0) + s.clicks)
    })

    const topBlocks = blocks
      .map(b => ({ ...b, clicks: blockClicksMap.get(b.id) ?? 0 }) as TopBlock)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)

    return {
      success: true,
      data: {
        summary: {
          totalViews,
          totalClicks,
          clickRate,
          activeBlocks: blocks.filter(b => b.active).length
        },
        profileStats,
        blockStats,
        topBlocks
      }
    }
  } catch (err) {
    logError('getAnalyticsSummary', err, { profileId, days })
    return { success: false, error: normalizeError(err) }
  }
}

// ==================== RPC FUNCTIONS ====================

export async function incrementProfileView(username: string, source = 'direct'): Promise<Result<void>> {
  if (typeof username !== 'string' || username.trim() === '') {
    return { success: false, error: new Error('Invalid username') }
  }
  
  try {
    const { error } = await supabase.rpc('increment_profile_view', { p_username: username, p_source: source })
    
    if (error) return { success: false, error, message: error.message }
    return { success: true, data: undefined }
  } catch (err) {
    logError('incrementProfileView', err, { username, source })
    return { success: false, error: normalizeError(err) }
  }
}

export async function incrementBlockClick(blockId: string): Promise<Result<void>> {
  if (typeof blockId !== 'string' || blockId.trim() === '') {
    return { success: false, error: new Error('Invalid block ID') }
  }

  try {
    const { error } = await supabase.rpc('increment_block_click', { p_block_id: blockId })
    if (error) return { success: false, error, message: error.message }
    return { success: true, data: undefined }
  } catch (err) {
    logError('incrementBlockClick', err, { blockId })
    return { success: false, error: normalizeError(err) }
  }
}

export async function canAddBlock(profileId: string): Promise<Result<boolean>> {
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return { success: false, error: new Error('Invalid profile ID') }
  }

  try {
    const { data, error } = await supabase.rpc('can_add_block', { p_profile_id: profileId })
    if (error) return { success: false, error, message: error.message }
    return { success: true, data: !!data }
  } catch (err) {
    logError('canAddBlock', err, { profileId })
    return { success: false, error: normalizeError(err) }
  }
}

// ==================== PLANS ====================

export async function getPlanLimits(plan: string): Promise<Result<PlanLimit>> {
  if (typeof plan !== 'string' || plan.trim() === '') {
    return { success: false, error: new Error('Invalid plan identifier') }
  }

  const cached = planCache.get(plan)
  if (cached && Date.now() - cached.timestamp < PLAN_CACHE_TTL) {
    return { success: true, data: cached.data }
  }

  if (cached) planCache.delete(plan)

  try {
    const res = await supabase.from('plan_limits').select('*').eq('plan', plan).single()

    const result = handleSupabaseSingle(res, 'Plan limits not found')

    if (result.success) {
      planCache.set(plan, {
        data: result.data,
        timestamp: Date.now()
      });
    }

    return result
  } catch (err) {
    logError('getPlanLimits', err, { plan })
    return { success: false, error: normalizeError(err) }
  }
}

export async function getAllPlanLimits(): Promise<Result<PlanLimit[]>> {
  if (allPlansCache && Date.now() - allPlansCache.timestamp < PLAN_CACHE_TTL) {
    return { success: true, data: allPlansCache.data }
  }

  try {
    const res = await supabase
      .from('plan_limits')
      .select('*')
      .order('monthly_price_cents', { ascending: true })

    const result = handleSupabaseArray(res)

    if (result.success) {
      allPlansCache = {
        data: result.data,
        timestamp: Date.now()
      }
    }
    
    return result
  } catch (err) {
    logError('getAllPlanLimits', err)
    return { success: false, error: normalizeError(err) }
  }
}

// ==================== DASHBOARD ====================

export async function getCreatorDashboard(userId: string): Promise<Result<CreatorDashboard>> {
  if (typeof userId !== 'string' || userId.trim().length < 8) {
    return { success: false, error: new Error('Invalid user ID') }
  }

  try {
    const blocksRes = await getBlocks(userId)
    if (!blocksRes.success) return blocksRes
    const blocks = blocksRes.data

    const analyticsRes = await getAnalyticsSummary(userId, DEFAULT_STATS_DAYS)
    if (!analyticsRes.success) return analyticsRes
    const analytics = analyticsRes.data

    const chartData = {
      labels: analytics.profileStats.map(s => new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })),
      views: analytics.profileStats.map(s => s.views),
      clicks: analytics.profileStats.map(s => {
        return analytics.blockStats
          .filter(bs => bs.date === s.date)
          .reduce((sum, bs) => sum + bs.clicks, 0)
      })
    }

    return {
      success: true,
      data: {
        blocks: blocks.filter(b => b.active),
        stats: analytics.summary,
        chartData,
        topBlocks: analytics.topBlocks
      }
    }
  } catch (err) {
    logError('getCreatorDashboard', err, { userId })
    return { success: false, error: normalizeError(err) }
  }
}