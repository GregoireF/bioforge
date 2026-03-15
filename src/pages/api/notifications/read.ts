// src/pages/api/notifications/read.ts
// PATCH /api/notifications/read  → marquer lu (1 ou toutes)
// Body: { id?: number }  — sans id = mark all read
import type { APIRoute } from 'astro';
import { wrapApiHandler } from '@/lib/api/middleware';

export const PATCH: APIRoute = wrapApiHandler<{ id?: number }, { updated: number }>(
  async ({ supabase, user, body }) => {
    const query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    // Si un id est fourni, ne marquer que celle-là
    if (body?.id) query.eq('id', body.id);

    const { error, count } = await query.select('id', { count: 'exact', head: true });

    if (error) throw new Error(error.message);

    return { updated: count ?? 0 };
  }
);