import type { Database } from '@/lib/infra/supabase/database.types'
import {
  type Supabase, type Result,
  handleArray, normalizeError, logError, isValidUUID,
  MAX_STATS_DAYS, DEFAULT_STATS_DAYS, getStartDate,
} from './utils'
import { ok, err } from '@/lib/core/result'
import { getBlocks } from './blocks'
import type { Block } from './blocks'

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyProfileView = Database['public']['Views']['mv_daily_profile_views']['Row']
type DailyBlockClick  = Database['public']['Views']['mv_daily_block_clicks']['Row']
type ProfileViews30d  = Database['public']['Views']['v_profile_views_30d']['Row']
type TopBlock30d      = Database['public']['Views']['v_top_blocks_30d']['Row']
type CountryBreakdown = Database['public']['Views']['v_country_breakdown_30d']['Row']
type TopReferrer      = Database['public']['Views']['v_top_referrers_30d']['Row']

export type TopBlock = Block & { clicks: number }

export type AnalyticsSummary = {
  summary:     { totalViews: number; totalClicks: number; clickRate: number; activeBlocks: number }
  profileStats: DailyProfileView[]
  blockStats:   DailyBlockClick[]
  topBlocks:    TopBlock[]
}

export type CreatorDashboard = {
  blocks:    Block[]
  stats:     AnalyticsSummary['summary']
  chartData: { labels: string[]; views: number[]; clicks: number[] }
  topBlocks: TopBlock[]
}

export type FullAnalytics = {
  summary:   AnalyticsSummary['summary']
  daily:     ProfileViews30d[]
  topBlocks: TopBlock30d[]
  countries: CountryBreakdown[]
  referrers: TopReferrer[]
}

// ─── Helpers internes ─────────────────────────────────────────────────────────
function calcSummary(
  profileStats: DailyProfileView[],
  blockStats: DailyBlockClick[],
  activeBlocks: number
): AnalyticsSummary['summary'] {
  const totalViews  = profileStats.reduce((s, r) => s + (r.views  ?? 0), 0)
  const totalClicks = blockStats.reduce((s, r) =>   s + (r.clicks ?? 0), 0)
  return {
    totalViews,
    totalClicks,
    clickRate:    totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0,
    activeBlocks,
  }
}

function buildClickMaps(blockStats: DailyBlockClick[]) {
  const byDate  = new Map<string, number>()
  const byBlock = new Map<string, number>()
  for (const s of blockStats) {
    if (s.date)     byDate.set(s.date, (byDate.get(s.date) ?? 0) + (s.clicks ?? 0))
    if (s.block_id) byBlock.set(s.block_id, (byBlock.get(s.block_id) ?? 0) + (s.clicks ?? 0))
  }
  return { byDate, byBlock }
}

function buildTopBlocks(blocks: Block[], byBlock: Map<string, number>): TopBlock[] {
  return blocks
    .map(b => ({ ...b, clicks: byBlock.get(b.id) ?? 0 }) as TopBlock)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5)
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export async function getProfileStats(
  db: Supabase,
  profileId: string,
  days = DEFAULT_STATS_DAYS
): Promise<Result<DailyProfileView[], Error>> {
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  const safeDays = Math.min(Math.max(1, days), MAX_STATS_DAYS)
  try {
    return handleArray(
      await db
        .from('mv_daily_profile_views')
        .select('*')
        .eq('profile_id', profileId)
        .gte('date', getStartDate(safeDays))
        .order('date', { ascending: true })
    )
  } catch (e) {
    logError('getProfileStats', e, { profileId, days: safeDays })
    return err(normalizeError(e))
  }
}

export async function getBlockStats(
  db: Supabase,
  blockIds: string[],
  days = DEFAULT_STATS_DAYS
): Promise<Result<DailyBlockClick[], Error>> {
  if (!blockIds.length) return ok([])

  const safeDays = Math.min(Math.max(1, days), MAX_STATS_DAYS)
  try {
    return handleArray(
      await db
        .from('mv_daily_block_clicks')
        .select('*')
        .in('block_id', blockIds)
        .gte('date', getStartDate(safeDays))
        .order('date', { ascending: true })
    )
  } catch (e) {
    logError('getBlockStats', e, { blockCount: blockIds.length, days: safeDays })
    return err(normalizeError(e))
  }
}

export async function getFullAnalytics(
  db: Supabase,
  profileId: string
): Promise<Result<FullAnalytics, Error>> {
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  try {
    const [dailyRes, topBlocksRes, countriesRes, referrersRes, blocksRes] = await Promise.all([
      db.from('v_profile_views_30d').select('*').eq('profile_id', profileId).order('view_date', { ascending: true }),
      db.from('v_top_blocks_30d').select('*').eq('profile_id', profileId).order('clicks', { ascending: false }),
      db.from('v_country_breakdown_30d').select('*').eq('profile_id', profileId).order('views', { ascending: false }),
      db.from('v_top_referrers_30d').select('*').eq('profile_id', profileId).order('hits', { ascending: false }),
      getBlocks(db, profileId),
    ])

    if (!blocksRes.success) return err(new Error(blocksRes.error.message))

    const daily     = dailyRes.data     ?? []
    const topBlocks = topBlocksRes.data ?? []
    const countries = countriesRes.data ?? []
    const referrers = referrersRes.data ?? []
    const blocks    = blocksRes.value

    const totalViews  = daily.reduce((s, r) => s + (r.views ?? 0), 0)
    const totalClicks = topBlocks.reduce((s, r) => s + (r.clicks ?? 0), 0)

    return ok({
      summary: {
        totalViews,
        totalClicks,
        clickRate:    totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0,
        activeBlocks: blocks.filter(b => b.active).length,
      },
      daily,
      topBlocks,
      countries,
      referrers,
    })
  } catch (e) {
    logError('getFullAnalytics', e, { profileId })
    return err(normalizeError(e))
  }
}

export async function getAnalyticsSummary(
  db: Supabase,
  profileId: string,
  days = DEFAULT_STATS_DAYS
): Promise<Result<AnalyticsSummary, Error>> {
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  try {
    const [blocksRes, statsRes] = await Promise.all([
      getBlocks(db, profileId),
      getProfileStats(db, profileId, days),
    ])

    if (!blocksRes.success) return err(blocksRes.error)
    if (!statsRes.success)  return err(statsRes.error)

    const blocks       = blocksRes.value
    const profileStats = statsRes.value

    const blockStatsRes = await getBlockStats(db, blocks.map(b => b.id), days)
    if (!blockStatsRes.success) return err(blockStatsRes.error)
    const blockStats = blockStatsRes.value

    const { byBlock } = buildClickMaps(blockStats)

    return ok({
      summary:     calcSummary(profileStats, blockStats, blocks.filter(b => b.active).length),
      profileStats,
      blockStats,
      topBlocks:   buildTopBlocks(blocks, byBlock),
    })
  } catch (e) {
    logError('getAnalyticsSummary', e, { profileId, days })
    return err(normalizeError(e))
  }
}

export async function getCreatorDashboard(
  db: Supabase,
  profileId: string
): Promise<Result<CreatorDashboard, Error>> {
  if (!isValidUUID(profileId)) return err(new Error('Invalid profile ID'))

  try {
    const [blocksRes, statsRes] = await Promise.all([
      getBlocks(db, profileId),
      getProfileStats(db, profileId, DEFAULT_STATS_DAYS),
    ])

    if (!blocksRes.success) return err(blocksRes.error)
    if (!statsRes.success)  return err(statsRes.error)

    const blocks       = blocksRes.value
    const profileStats = statsRes.value

    const blockStatsRes = await getBlockStats(db, blocks.map(b => b.id), DEFAULT_STATS_DAYS)
    if (!blockStatsRes.success) return err(blockStatsRes.error)
    const blockStats = blockStatsRes.value

    const { byDate, byBlock } = buildClickMaps(blockStats)

    return ok({
      blocks:    blocks.filter(b => b.active),
      stats:     calcSummary(profileStats, blockStats, blocks.filter(b => b.active).length),
      chartData: {
        labels: profileStats.map(s => s.date
          ? new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short' })
          : ''
        ),
        views:  profileStats.map(s => s.views ?? 0),
        clicks: profileStats.map(s => s.date ? (byDate.get(s.date) ?? 0) : 0),
      },
      topBlocks: buildTopBlocks(blocks, byBlock),
    })
  } catch (e) {
    logError('getCreatorDashboard', e, { profileId })
    return err(normalizeError(e))
  }
}

// ── RPC helpers ───────────────────────────────────────────────────────────────
export async function incrementProfileView(
  db: Supabase,
  username: string,
  source = 'direct'
): Promise<Result<void, Error>> {
  if (typeof username !== 'string' || !username.trim())
    return err(new Error('Invalid username'))

  try {
    const { error } = await db.rpc('increment_profile_view', { p_username: username, p_source: source })
    if (error) return err(new Error(error.message))
    return ok(undefined as void)
  } catch (e) {
    logError('incrementProfileView', e, { username })
    return err(normalizeError(e))
  }
}

export async function incrementBlockClick(
  db: Supabase,
  blockId: string
): Promise<Result<void, Error>> {
  if (!isValidUUID(blockId)) return err(new Error('Invalid block ID'))

  try {
    const { error } = await db.rpc('increment_block_click', { p_block_id: blockId })
    if (error) return err(new Error(error.message))
    return ok(undefined as void)
  } catch (e) {
    logError('incrementBlockClick', e, { blockId })
    return err(normalizeError(e))
  }
}