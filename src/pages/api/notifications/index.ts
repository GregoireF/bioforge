// src/pages/api/notifications/index.ts
// GET  /api/notifications       → liste (50 dernières, unread first)
// POST /api/notifications       → créer une notif (service role only — analytics milestones)
import type { APIRoute } from 'astro';
import { wrapApiHandler } from '@/lib/api/middleware';

// ── GET — liste des notifications ──────────────────────────────────────────────
export const GET: APIRoute = wrapApiHandler<undefined, { notifications: any[]; unread: number }>(
  async ({ supabase, user }) => {
    const [listRes, countRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, type, title, body, icon, href, is_read, created_at, meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
    ]);

    return {
      notifications: listRes.data ?? [],
      unread: countRes.count ?? 0,
    };
  }
);

// ── POST — créer une notif milestone depuis l'API analytics ────────────────────
export const POST: APIRoute = wrapApiHandler<
  { user_id: string; type: string; title: string; body?: string; icon?: string; href?: string },
  { id: number }
>(
  async ({ supabase, body }) => {
    const { user_id, type, title, body: notifBody, icon = '✦', href } = body;

    if (!user_id || !type || !title) {
      throw new Error('user_id, type and title are required');
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id, type, title, body: notifBody, icon, href })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return { id: data.id };
  },
  { requireServiceRole: true } // Uniquement appelable côté serveur
);