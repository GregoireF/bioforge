import { createSupabaseServer } from '@/lib/infra/supabase/server';
import { getProfile, getProfileWithPlanLimits } from '@/lib/supabase/queries';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/infra/supabase/database.types';
import type { AstroCookies } from 'astro';



export interface AuthData {
  user: User | null;
  session: Session | null;
  profile?: Profile | null;
  planLimits?: any;
}

export interface AuthResult {
  success: boolean;
  data?: AuthData;
  error?: string;
  statusCode?: number;
  redirect?: string;
}

// Fonction de base : récupère session via client SSR
















export async function withAuth(
  context: { cookies: AstroCookies; request: Request }
): Promise<AuthResult> {
  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  });

  // 1. Récupère et valide la session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session || !session.user) {
    return {
      success: false,
      error: sessionError || new Error('Aucune session valide'),
      redirect: '/signin?error=session_invalid'
    };
  }

  const user = session.user;

  // 2. Validation stricte côté serveur (supprime le warning + plus sécurisé)
  const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser();


  if (userError || !validatedUser) {
    return {
      success: false,
      error: userError || new Error('Utilisateur invalide'),
      redirect: '/signin?error=invalid_user'
    };

  }

  // 3. Récupère le profile (en passant le client authentifié si possible)
  const profileResult = await getProfile(validatedUser.id);












  if (!profileResult.success || !profileResult.data) {
    return {
      success: false,
      error: new Error(profileResult.message || 'Profil introuvable'),
      redirect: '/signin?error=profile_missing'
    };






  }

  const profile = profileResult.data;














  // 4. Récupère les limites du plan (optionnel, seulement si nécessaire)
  let planLimits = null;
  try {
    const limitsResult = await getProfileWithPlanLimits(validatedUser.id);
    if (limitsResult.success) {
      planLimits = limitsResult.data;
    }
  } catch (err) {
    console.warn('Impossible de charger les limites du plan:', err);
  }

  return {
    success: true,
    data: {
      user: validatedUser,
      session,
      profile,
      planLimits,
    }
  };
}