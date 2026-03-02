import type { APIRoute } from 'astro'
import { parse } from 'cookie';
import { createServerClient } from '@supabase/ssr';

// ==================== CONFIG ====================

const SITE_URL = import.meta.env.PUBLIC_SITE_URL;

// ==================== HELPERS ====================

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getCurrentIso(): string {
  return new Date().toISOString()
}

// ==================== SUPABASE CLIENT ====================

function createSupabaseClient(request: Request) {
  const cookies = parse(request.headers.get('cookie') ?? '');

  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key: string) => cookies[key],
        set: () => {},
        remove: () => {},
      },
    }
  );
}

// ==================== AUTH ====================

async function requireAuth(request: Request) {
  const supabase = createSupabaseClient(request);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: 'UNAUTHENTICATED' as const };
  }

  return { user: data.user, supabase };
}

// DELETE ACCOUNT

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAuth(request);
    if ('error' in auth) {
      return json({ success: false, error: auth.error }, 401);
    }

    const { user, supabase } = auth;

    const { error } = await supabase
    .from('profiles')
    .update({
        deleted_at: getCurrentIso(),
        is_active: false
      })
    .eq('id', user.id); // ← user.id
    
  return json({ success: !error });
}