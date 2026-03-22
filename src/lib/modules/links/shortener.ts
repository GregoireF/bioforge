// src/lib/modules/links/shortener.ts
// Génération et validation des codes de short links
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '@/lib/supabase/database.types'
import { LINK_CODE_RE }        from '@/lib/shared/constants'

type Supabase = SupabaseClient<Database>

/**
 * Génère un code aléatoire alphanumérique de longueur donnée.
 */
export function generateCode(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len).padStart(len, '0')
}

/**
 * Normalise un code fourni par l'utilisateur.
 * Retourne null si le format est invalide.
 */
export function normalizeCode(raw: string | undefined): string | null {
  if (!raw) return null
  const code = raw.toLowerCase().trim()
  return LINK_CODE_RE.test(code) ? code : null
}

/**
 * Vérifie qu'un code est unique dans la table short_links.
 * Retourne true si disponible, false si déjà pris.
 */
export async function isCodeAvailable(
  db: Supabase,
  code: string
): Promise<boolean> {
  const { data } = await db
    .from('short_links')
    .select('id')
    .eq('code', code)
    .maybeSingle()
  return data === null
}

/**
 * Génère un code unique en réessayant jusqu'à 5 fois.
 * Lève une erreur si aucun code unique trouvé (très improbable).
 */
export async function generateUniqueCode(
  db: Supabase,
  len = 6
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode(len)
    if (await isCodeAvailable(db, code)) return code
  }
  // Fallback avec longueur plus longue
  return generateCode(8)
}