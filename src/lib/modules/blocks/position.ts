// src/lib/modules/blocks/position.ts
// Calcul de position pour les blocs — gaps de 10 pour insertion sans renumérotation
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '@/lib/supabase/database.types'

type Supabase = SupabaseClient<Database>

/**
 * Calcule la prochaine position disponible pour un nouveau bloc.
 * Utilise des multiples de 10 pour permettre l'insertion entre blocs.
 * Ex: blocs à 10, 20, 30 → nouveau = 40. Entre 10 et 20 → 15 (futur).
 */
export async function calcNextPosition(
  db: Supabase,
  profileId: string
): Promise<number> {
  const { data } = await db
    .from('blocks')
    .select('position')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastPos = data?.position ?? 0
  return Math.ceil((lastPos + 1) / 10) * 10
}

/**
 * Calcule les positions en bulk pour un reorder.
 * Retourne un tableau { id, position } en multiples de 10.
 */
export function calcReorderPositions(
  blockIds: string[]
): { id: string; position: number }[] {
  return blockIds.map((id, i) => ({ id, position: (i + 1) * 10 }))
}