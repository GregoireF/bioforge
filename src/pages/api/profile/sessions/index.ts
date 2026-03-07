// src/pages/api/sessions/index.ts
//
// Supabase ne fournit pas de liste de sessions via le client SDK standard.
// On stocke les sessions dans une table `user_sessions` côté Supabase.
//
// Schéma SQL minimal attendu :
// ─────────────────────────────────────────────────────────────────────────────
// create table user_sessions (
//   id          uuid primary key default gen_random_uuid(),
//   user_id     uuid references auth.users(id) on delete cascade not null,
//   browser     text,
//   os          text,
//   device_type text default 'desktop',  -- 'mobile' | 'tablet' | 'desktop'
//   ip          text,
//   last_seen   timestamptz default now(),
//   created_at  timestamptz default now()
// );
// alter table user_sessions enable row level security;
// create policy "Users see own sessions" on user_sessions for all using (auth.uid() = user_id);
// ─────────────────────────────────────────────────────────────────────────────
//
// La session courante doit être upsertée à chaque login dans ton auth middleware.

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
  async ({ supabase, user, request }) => {
    // Current session ID passed as header X-Session-Id (set by your auth middleware)
    const currentSessionId = request.headers.get('x-session-id') ?? null;

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