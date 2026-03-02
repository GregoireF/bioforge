import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { PostgrestError } from '@supabase/supabase-js'

// ==================== CONST ====================
const MAX_STATS_DAYS = 90
const DEFAULT_STATS_DAYS = 7
interface PlanLimit {
  plan: string;
  max_blocks: number;
  max_blocks_total?: number;
  // autres champs de ton plan (ex: max_links, storage, etc.)
}

const PLAN_CACHE_TTL = 1000 * 60 * 60; // 1 heure par exemple

// Cache en mémoire (Map ou WeakMap selon tes besoins)
const planCache = new Map<string, { data: PlanLimit; timestamp: number }>();
let allPlansCache: CachedPlans | null = null

// ==================== TYPES ====================
type CachedPlan = { data: PlanLimit; timestamp: number }
type CachedPlans = { data: PlanLimit[]; timestamp: number }

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

type Block = Database['public']['Tables']['blocks']['Row']
export type BlockInsert = Database['public']['Tables']['blocks']['Insert']
export type BlockUpdate = Database['public']['Tables']['blocks']['Update']

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
  chartData: { labels: string[]; views: number[]; clicks: number[] }
  topBlocks: TopBlock[]
}

export type ReorderError = { failed: string[]; message: string }

// ==================== UTILS ====================
function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  return new Error('Unknown error occurred')
}

function logError(context: string, err: unknown, meta: Record<string, any> = {}) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), ctx: context, err: err instanceof Error ? { name: err.name, msg: err.message, stack: err.stack?.split('\n').slice(0,6).join('\n') } : err, ...meta }, null, 2))
}

function handleSupabaseSingle<T>({ data, error }: { data: T | null; error: PostgrestError | null }, notFoundMsg = 'Resource not found'): Result<T> {
  if (error) return { success: false, error, message: error.message }
  if (!data) return { success: false, error: new Error(notFoundMsg) }
  return { success: true, data }
}

function handleSupabaseArray<T>({ data, error }: { data: T[] | null; error: PostgrestError | null }): Result<T[]> {
  if (error) return { success: false, error, message: error.message }
  return { success: true, data: data ?? [] }
}

function getCurrentIso() { return new Date().toISOString() }
function getStartDate(days: number) {
  const safeDays = Math.min(Math.max(1, days), MAX_STATS_DAYS)
  const date = new Date()
  date.setDate(date.getDate() - safeDays)
  return date.toISOString().split('T')[0]
}

function validateUUID(uuid: string | null | undefined): boolean {
  if (!uuid || typeof uuid !== 'string') {
    console.log('[validateUUID] Rejet : vide ou pas string', uuid);
    return false;
  }

  const clean = uuid.trim().replace(/[^0-9a-fA-F-]/g, '').toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

  const isValid = uuidRegex.test(clean) && (clean.length === 36 || clean.length === 32);

  if (!isValid) {
    console.log('[validateUUID] Échec validation :', {
      original: uuid,
      clean,
      length: clean.length,
      match: uuidRegex.test(clean)
    });
  }

  return isValid;
}

// ==================== PROFILES ====================
export async function getProfile(
  client: SupabaseClient,
  userId: string
): Promise<Result<Profile>> {
  // Log très détaillé pour voir EXACTEMENT ce qu'on reçoit
  console.log('[getProfile] userId reçu (raw) :', JSON.stringify(userId));
  console.log('[getProfile] Type de userId :', typeof userId);
  console.log('[getProfile] Longueur brute :', userId?.length ?? 'undefined');

  if (!userId || typeof userId !== 'string') {
    console.log('[getProfile] Rejet : userId vide ou pas string');
    return { success: false, error: new Error('Invalid user ID: not a string') };
  }

  const trimmed = userId.trim();
  console.log('[getProfile] Après trim :', trimmed);
  console.log('[getProfile] Longueur après trim :', trimmed.length);

  // Validation ultra-tolérante + loguée
  const clean = trimmed.replace(/[^0-9a-fA-F-]/g, '').toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

  const isValid = uuidRegex.test(clean) && (clean.length === 36 || clean.length === 32);

  console.log('[getProfile] Clean UUID :', clean);
  console.log('[getProfile] Longueur clean :', clean.length);
  console.log('[getProfile] Match regex :', uuidRegex.test(clean));
  console.log('[getProfile] Validation finale :', isValid ? 'VALID' : 'INVALID');

  if (!isValid) {
    return { success: false, error: new Error('Invalid user ID: format UUID incorrect') };
  }

  try {
    const res = await client
      .from('profiles')
      .select('*')
      .eq('id', trimmed)  // utilise trimmed pour être sûr
      .is('deleted_at', null)
      .single();

    const result = handleSupabaseSingle(res, 'Profile not found');

    if (result.success) {
      console.log('[getProfile] Profil trouvé : ID =', result.data?.id);
    } else {
      console.log('[getProfile] Échec requête Supabase :', result.error);
    }

    return result;
  } catch (err) {
    logError('getProfile', err, { userId: trimmed });
    return { success: false, error: normalizeError(err) };
  }
}

export async function updateProfile(client: SupabaseClient, userId: string, updates: ProfileUpdate): Promise<Result<Profile>> {
  if (!validateUUID(userId)) return { success: false, error: new Error('Invalid user ID') }
  try {
    const res = await client.from('profiles').update({ ...updates, updated_at: getCurrentIso() }).eq('id', userId).select().maybeSingle()
    return handleSupabaseSingle(res, 'Profile not found or update failed')
  } catch (err) { logError('updateProfile', err, { userId, updatedFields: Object.keys(updates) }); return { success: false, error: normalizeError(err) } }
}

export async function createProfile(client: SupabaseClient, profile: ProfileInsert): Promise<Result<Profile>> {
  if (!profile.id || !profile.username) return { success: false, error: new Error('ID and username required') }
  try {
    const res = await client.from('profiles').insert(profile).select().single()
    return handleSupabaseSingle(res, 'Profile creation failed')
  } catch (err) { logError('createProfile', err, { username: profile.username }); return { success: false, error: normalizeError(err) } }
}

// ==================== BLOCKS ====================

// GET all blocks (TON ORIGINAL)
export async function getBlocks(client: SupabaseClient, profileId: string): Promise<Result<Block[]>> {
  if (!validateUUID(profileId)) return { success: false, error: new Error('Invalid profile ID') }
  try {
    const res = await client
      .from('blocks')
      .select('*')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('position', { ascending: true })
    return handleSupabaseArray(res)
  } catch (err) {
    logError('getBlocks', err, { profileId })
    return { success: false, error: normalizeError(err) }
  }
}

async function getNextPosition(client: SupabaseClient, profileId: string): Promise<number> {
  const { data, error } = await client
    .from('blocks')
    .select('position')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getNextPosition] Erreur fetch position :', error);
    return 0; // fallback safe
  }

  return (data?.position ?? -1) + 1;
}

// Fonction principale pour créer un bloc avec position auto-incrémentée
export async function createBlock(
  client: SupabaseClient, 
  block: BlockInsert
): Promise<Result<Block>> {
  try {
    // Force UUID valide pour profil
    if (!validateUUID(block.profile_id)) {
      return { success: false, error: new Error('Invalid profile ID') };
    }

    // Calcule la prochaine position disponible
    const newPosition = await getNextPosition(client, block.profile_id);

    const payload = {
      ...block,
      config: block.config ?? {},
      position: newPosition,
      active: block.active ?? true,
      deleted_at: null,
    };

    console.log('[createBlock] Payload avant insert :', payload);

    const { data: inserted, error: insertErr } = await client
      .from('blocks')
      .insert(payload)
      .select('*') // récupère toutes les colonnes
      .single();   // retourne un objet, pas un tableau

    if (insertErr) {
      console.error('[createBlock] Erreur insert :', insertErr);
      return { success: false, error: insertErr };
    }

    if (!inserted) {
      console.error('[createBlock] Insert OK mais row non retournée');
      return { success: false, error: new Error('Insert succeeded but no row returned') };
    }

    console.log('[createBlock] Bloc créé avec succès :', inserted);
    return { success: true, data: inserted };
  } catch (err) {
    console.error('[createBlock] Exception :', err);
    return { success: false, error: normalizeError(err) };
  }
}

// GET single block (NOUVEAU)
export async function getBlock(client: SupabaseClient, blockId: string, profileId: string): Promise<Result<Block>> {
  if (!validateUUID(blockId)) return { success: false, error: new Error('Invalid block ID') }
  if (!validateUUID(profileId)) return { success: false, error: new Error('Invalid profile ID') }
  try {
    const res = await client
      .from('blocks')
      .select('*')
      .eq('id', blockId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .single()
    return handleSupabaseSingle(res, 'Block not found')
  } catch (err) {
    logError('getBlock', err, { blockId, profileId })
    return { success: false, error: normalizeError(err) }
  }
}

// UPDATE block (NOUVEAU)
export async function updateBlock(
  client: SupabaseClient,
  blockId: string,
  profileId: string,
  updates: BlockUpdate
): Promise<Result<Block>> {
  if (!validateUUID(blockId)) return { success: false, error: new Error('Invalid block ID') }
  if (!validateUUID(profileId)) return { success: false, error: new Error('Invalid profile ID') }
  try {
    const res = await client
      .from('blocks')
      .update({ ...updates, updated_at: getCurrentIso() })
      .eq('id', blockId)
      .eq('profile_id', profileId)
      .select()
      .maybeSingle()
    return handleSupabaseSingle(res, 'Block not found or update failed')
  } catch (err) {
    logError('updateBlock', err, { blockId, profileId, updatedFields: Object.keys(updates) })
    return { success: false, error: normalizeError(err) }
  }
}

export async function deleteBlock(
  client: SupabaseClient,
  blockId: string,
  profileId: string
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('blocks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', blockId)
      .eq('profile_id', profileId);

    if (error) return { success: false, error };
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err };
  }
}

// REORDER blocks (NOUVEAU)
export async function reorderBlocks(
  client: SupabaseClient,
  profileId: string,
  blockIds: string[]
): Promise<Result<void, ReorderError>> {
  if (!validateUUID(profileId)) return { success: false, error: { failed: [], message: 'Invalid profile ID' } }
  if (blockIds.length === 0) return { success: false, error: { failed: [], message: 'Empty block list' } }
  
  try {
    const blocksRes = await getBlocks(client, profileId)
    if (!blocksRes.success) return { success: false, error: { failed: [], message: 'Failed to fetch blocks' } }
    
    const userBlockIds = new Set(blocksRes.data.map(b => b.id))
    const invalidIds = blockIds.filter(id => !userBlockIds.has(id))
    
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: { failed: invalidIds, message: 'Some blocks do not belong to this profile' }
      }
    }
    
    const failed: string[] = []
    for (let i = 0; i < blockIds.length; i++) {
      const blockId = blockIds[i]
      const { error } = await client
        .from('blocks')
        .update({ position: i, updated_at: getCurrentIso() })
        .eq('id', blockId)
        .eq('profile_id', profileId)
      
      if (error) {
        failed.push(blockId)
        logError('reorderBlocks:update', error, { blockId, position: i })
      }
    }
    
    if (failed.length > 0) {
      return {
        success: false,
        error: { failed, message: `Failed to reorder ${failed.length} block(s)` }
      }
    }
    
    return { success: true, data: undefined }
  } catch (err) {
    logError('reorderBlocks', err, { profileId, blockCount: blockIds.length })
    return {
      success: false,
      error: { failed: blockIds, message: normalizeError(err).message }
    }
  }
}

// TRACK click (NOUVEAU)
export async function trackBlockClick(
  client: SupabaseClient,
  blockId: string,
  profileId: string
): Promise<Result<void>> {
  if (!validateUUID(blockId)) return { success: false, error: new Error('Invalid block ID') }
  if (!validateUUID(profileId)) return { success: false, error: new Error('Invalid profile ID') }
  
  try {
    const blockRes = await getBlock(client, blockId, profileId)
    if (!blockRes.success) return blockRes
    if (!blockRes.data.active) {
      return { success: false, error: new Error('Block is not active') }
    }
    
    const { error } = await client
      .from('block_clicks')
      .insert({
        block_id: blockId,
        profile_id: profileId,
        clicked_at: getCurrentIso()
      })
    
    if (error) return { success: false, error, message: error.message }
    
    return { success: true, data: undefined }
  } catch (err) {
    logError('trackBlockClick', err, { blockId, profileId })
    return { success: false, error: normalizeError(err) }
  }
}


// ==================== PLANS ====================
export async function getPlanLimits(
  client: SupabaseClient,
  plan: string | null | undefined
): Promise<Result<PlanLimit>> {
  // Normalisation systématique du plan (minuscule + trim)
  const normalizedPlan = (plan ?? 'free').trim().toLowerCase();

  if (!normalizedPlan) {
    return {
      success: false,
      error: new Error('Invalid or missing plan identifier')
    };
  }

  // Vérification du cache avec clé normalisée
  const cached = planCache.get(normalizedPlan);
  if (cached && Date.now() - cached.timestamp < PLAN_CACHE_TTL) {
    console.log(`[getPlanLimits] Cache HIT pour "${normalizedPlan}"`);
    return { success: true, data: cached.data };
  }

  try {
    console.log(`[getPlanLimits] Recherche plan_limits pour "${normalizedPlan}"`);

    const { data, error } = await client
      .from('plan_limits')
      .select('*')
      .eq('plan', normalizedPlan)
      .maybeSingle(); // ← .maybeSingle() au lieu de .single() → plus sûr

    if (error) {
      console.error('[getPlanLimits] Erreur Supabase:', error.message);
      throw error;
    }

    // Si pas trouvé → fallback sur des valeurs par défaut
    if (!data) {
      console.warn(`[getPlanLimits] Plan "${normalizedPlan}" non trouvé → fallback default`);

      const defaultLimits: PlanLimit = {
        plan: normalizedPlan,
        max_blocks: 15,           // valeur par défaut raisonnable pour free
        max_blocks_total: 15,
        // ajoute d'autres defaults si besoin
      };

      // On met en cache pour éviter de spammer la DB
      planCache.set(normalizedPlan, {
        data: defaultLimits,
        timestamp: Date.now(),
      });

      return { success: true, data: defaultLimits };
    }

    // Succès : on met en cache et on retourne
    planCache.set(normalizedPlan, {
      data,
      timestamp: Date.now(),
    });

    console.log(`[getPlanLimits] Succès → max_blocks = ${data.max_blocks}`);

    return { success: true, data };

  } catch (err) {
    logError('getPlanLimits', err, { requestedPlan: plan, normalized: normalizedPlan });

    // Fallback même en cas d'erreur critique (pour ne jamais bloquer l'utilisateur)
    const fallback: PlanLimit = {
      plan: normalizedPlan,
      max_blocks: 10, // valeur conservatrice en cas d'erreur
      max_blocks_total: 10,
    };

    return { success: true, data: fallback };
  }
}

// ==================== STATS / DASHBOARD ====================

/**
 * Récupère les stats quotidiennes du profile
 */
export async function getProfileStats(
  client: SupabaseClient,
  profileId: string,
  days: number = 30
): Promise<Result<DailyProfileStats[]>> {
  if (!validateUUID(profileId)) {
    return { success: false, error: new Error('Invalid profile ID') };
  }

  try {
    const startDate = getStartDate(days);
    console.log('[getProfileStats] Requête : profile_id =', profileId, 'depuis', startDate);

    const res = await client
      .from('daily_profile_stats')
      .select('*')
      .eq('profile_id', profileId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    const result = handleSupabaseArray(res);
    if (result.success) {
      console.log('[getProfileStats] Succès :', result.data.length, 'jours trouvés');
    } else {
      console.error('[getProfileStats] Échec Supabase :', result.error);
    }

    return result;
  } catch (err) {
    logError('getProfileStats', err, { profileId, days });
    return { success: false, error: normalizeError(err) };
  }
}

/**
 * Récupère les stats quotidiennes pour une liste de blocks
 */
export async function getBlockStats(
  client: SupabaseClient,
  blockIds: string[],
  days: number = 30
): Promise<Result<DailyBlockStats[]>> {
  if (!blockIds.length) {
    console.log('[getBlockStats] Aucun block ID → retour tableau vide');
    return { success: true, data: [] };
  }

  try {
    const startDate = getStartDate(days);
    console.log('[getBlockStats] Requête pour', blockIds.length, 'blocks depuis', startDate);

    const res = await client
      .from('daily_block_stats')
      .select('*')
      .in('block_id', blockIds)
      .gte('date', startDate)
      .order('date', { ascending: true });

    const result = handleSupabaseArray(res);
    if (result.success) {
      console.log('[getBlockStats] Succès :', result.data.length, 'entrées');
    } else {
      console.error('[getBlockStats] Échec Supabase :', result.error);
    }

    return result;
  } catch (err) {
    logError('getBlockStats', err, { blockIdsCount: blockIds.length, days });
    return { success: false, error: normalizeError(err) };
  }
}

/**
 * Résumé analytique global + top blocks
 */
export async function getAnalyticsSummary(
  client: SupabaseClient,
  profileId: string,
  days: number = DEFAULT_STATS_DAYS
): Promise<Result<AnalyticsSummary>> {
  console.log('[getAnalyticsSummary] Début pour profile', profileId, 'jours =', days);

  if (!validateUUID(profileId)) {
    console.log('[getAnalyticsSummary] Validation UUID échouée');
    return { success: false, error: new Error('Invalid profile ID') };
  }

  try {
    const [profileStatsRes, blocksRes] = await Promise.all([
      getProfileStats(client, profileId, days),
      getBlocks(client, profileId)
    ]);

    console.log('[getAnalyticsSummary] profileStatsRes :', profileStatsRes.success ? 'OK' : 'KO');
    console.log('[getAnalyticsSummary] blocksRes :', blocksRes.success ? 'OK' : 'KO');

    if (!profileStatsRes.success) return profileStatsRes;
    if (!blocksRes.success) return blocksRes;

    const profileStats = profileStatsRes.data ?? [];
    const blocks = blocksRes.data ?? [];
    const blockIds = blocks.map(b => b.id);

    console.log('[getAnalyticsSummary] Blocks trouvés :', blocks.length);
    console.log('[getAnalyticsSummary] blockIds :', blockIds);

    let blockStats: DailyBlockStats[] = [];
    if (blockIds.length > 0) {
      const blockStatsRes = await getBlockStats(client, blockIds, days);
      if (!blockStatsRes.success) return blockStatsRes;
      blockStats = blockStatsRes.data ?? [];
      console.log('[getAnalyticsSummary] blockStats trouvés :', blockStats.length);
    } else {
      console.log('[getAnalyticsSummary] Aucun block → blockStats vide');
    }

    // Calculs sécurisés + logs
    const totalViews = profileStats.reduce((sum, s) => sum + (s.views ?? 0), 0);
    const totalClicks = blockStats.reduce((sum, s) => sum + (s.clicks ?? 0), 0);
    const clickRate = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0;

    console.log('[getAnalyticsSummary] Calculs finaux :', { totalViews, totalClicks, clickRate });

    const blockClicksMap = new Map<string, number>();
    blockStats.forEach(s => {
      const current = blockClicksMap.get(s.block_id) ?? 0;
      blockClicksMap.set(s.block_id, current + (s.clicks ?? 0));
    });

    const topBlocks = blocks
      .map(b => ({
        ...b,
        clicks: blockClicksMap.get(b.id) ?? 0
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    console.log('[getAnalyticsSummary] Top blocks :', topBlocks.map(b => ({ id: b.id, clicks: b.clicks })));

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
    };
  } catch (err) {
    logError('getAnalyticsSummary', err, { profileId, days });
    console.error('[getAnalyticsSummary] Erreur globale :', err);
    return { success: false, error: normalizeError(err) };
  }
}

export async function canAddBlock(supabase: SupabaseClient, profileId: string): Promise<boolean> {
  // Récupère le nombre actuel de blocs
  const { count, error } = await supabase
    .from('blocks')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('deleted_at', null);

  if (error) {
    console.error('Erreur comptage blocs :', error);
    return false;
  }

  const currentCount = count ?? 0;

  // Récupère le plan et la limite (exemple : via profiles ou une table plans)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan') // ou 'max_blocks'
    .eq('id', profileId)
    .single();

  const maxBlocks = profile?.plan === 'pro' ? Infinity : 10; // adapte selon tes plans

  return currentCount < maxBlocks;
}

export async function getActiveBlocks(supabase: SupabaseClient, profileId: string): Promise<Result<Block[]>> {
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