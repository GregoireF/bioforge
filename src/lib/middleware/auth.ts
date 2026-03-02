import type { AstroCookies } from 'astro';
import { createServerClient } from '@supabase/ssr';
import type { Result, AppError } from '@/lib/supabase'
import { getPlanLimits } from '@/config/plan';

// ==================== TYPES ====================

export interface AuthData {
  user: any;
  profile: any;
  planLimits: any;
}

export interface AuthResult extends Result<AuthData> {
  redirect?: string;
}

// ==================== CREATE SUPABASE CLIENT WITH CORRECT COOKIES ====================

function createSupabaseClient(cookies: AstroCookies) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key: string) {
          const value = cookies.get(key)?.value;
          console.log(`[MW COOKIE GET] ${key}:`, value ? 'EXISTS' : 'NULL');
          return value;
        },
        set(key: string, value: string, options: any) {
          console.log(`[MW COOKIE SET] ${key}:`, value ? 'SET' : 'NULL');
          cookies.set(key, value, {
            ...options,
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: import.meta.env.PROD,
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
        },
        remove(key: string, options: any) {
          console.log(`[MW COOKIE REMOVE] ${key}`);
          cookies.delete(key, {
            ...options,
            path: '/',
          });
        },
      },
    }
  );
}

// ==================== WITH AUTH ====================

export async function withAuth(cookies: AstroCookies): Promise<AuthResult> {
  try {
    console.log('\n=== MIDDLEWARE: withAuth START ===');
    
    const supabase = createSupabaseClient(cookies);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log('[MW] User:', user ? user.id : 'NULL');
    
    if (userError) {
      console.error('[MW] User error:', userError.message);
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication failed',
          details: userError.message
        },
        redirect: '/signin'
      };
    }

    if (!user) {
      console.log('[MW] No user found');
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Not authenticated'
        },
        redirect: '/signin'
      };
    }

    // Get profile using user.id (not auth.uid() which doesn't work in API)
    console.log('[MW] Fetching profile for user:', user.id);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[MW] Profile error:', profileError);
      return {
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
          details: profileError.message
        },
        redirect: '/signin'
      };
    }

    if (!profile) {
      console.log('[MW] Profile not found for user');
      return {
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found'
        },
        redirect: '/signin'
      };
    }

    console.log('[MW] Profile found:', profile.username);

    // Get plan limits
    const planLimits = getPlanLimits(profile.plan || 'Free');

    console.log('=== MIDDLEWARE: withAuth SUCCESS ===\n');

    return {
      success: true,
      data: {
        user,
        profile,
        planLimits
      }
    };

  } catch (error) {
    console.error('=== MIDDLEWARE: withAuth ERROR ===');
    console.error(error);
    
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      redirect: '/signin'
    };
  }
}

// ==================== WITH AUTH AND LIMITS ====================

interface LimitCheckOptions {
  feature: 'blocks' | 'analytics';
  action: 'create' | 'view';
  currentCount?: number;
}

export async function withAuthAndLimits(
  cookies: AstroCookies,
  options: LimitCheckOptions
): Promise<AuthResult> {
  const authResult = await withAuth(cookies);

  if (!authResult.success) {
    return authResult;
  }

  const { profile, planLimits } = authResult.data;

  // Check limits for create actions
  if (options.action === 'create') {
    const limit = planLimits[`max_${options.feature}_total`];
    const current = options.currentCount || 0;

    console.log(`[MW] Limit check: ${current}/${limit} ${options.feature}`);

    if (limit !== -1 && current >= limit) {
      return {
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `You've reached the maximum number of ${options.feature} for your plan`,
          details: `Current: ${current}, Limit: ${limit}`
        }
      };
    }
  }

  return authResult;
}

export default { withAuth, withAuthAndLimits };