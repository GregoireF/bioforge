import type { APIRoute } from 'astro';
import { wrapApiHandler } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/core/errors';

interface Session {
  id: string;
  browser:     string | null;
  os:          string | null;
  device_type: string | null;
  ip:          string | null;
  last_seen:   string | null;
  created_at:  string | null;
}

// GET — list all sessions for the current user (most recent first)
export const GET: APIRoute = wrapApiHandler<undefined, Session[]>(
  async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, browser, os, device_type, ip, last_seen, created_at')
      .eq('user_id', user.id)
      .order('last_seen', { ascending: false });

    if (error) {
      throw new AppError({
        message: 'Failed to fetch sessions',
        code: ErrorCode.DB_ERROR,
        statusCode: 500,
      });
    }

    return data ?? [];
  }
);

// DELETE — revoke all sessions EXCEPT the current one
// The current session ID should be stored in a cookie or passed as a header.
export const DELETE: APIRoute = wrapApiHandler<undefined, { revoked: number }>(
  async ({ supabase, user, context }) => {
    // Current session ID passed as header X-Session-Id (set by your auth middleware)
    const currentSessionId = context.request.headers.get('x-session-id') ?? null;

    let query = supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', user.id);

    // Exclude current session if we know it
    if (currentSessionId) {
      query = query.neq('id', currentSessionId);
    }

    const { error, count } = await query;

    if (error) {
      throw new AppError({
        message: 'Failed to revoke sessions',
        code: ErrorCode.DB_ERROR,
        statusCode: 500,
      });
    }

    return { revoked: count ?? 0 };
  }
);