// src/pages/api/social-posts/[id].ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

export const DELETE: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { id } = ctx.params;
  if (!id) return err('Missing id', 400);

  const { error } = await sb.from('social_posts').delete().eq('id', id).eq('profile_id', auth.data.profile.id);
  if (error) return err(error.message, 500);
  return ok({ deleted: true });
};

export const PATCH: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { id } = ctx.params;
  if (!id) return err('Missing id', 400);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const allowed: any = {};
  if (body.content)     allowed.content     = body.content;
  if (body.status)      allowed.status      = body.status;
  if (body.platforms)   allowed.platforms   = body.platforms;
  if (body.scheduled_at !== undefined) allowed.scheduled_at = body.scheduled_at;

  const { data, error } = await sb.from('social_posts').update(allowed).eq('id', id).eq('profile_id', auth.data.profile.id).select().single();
  if (error) return err(error.message, 500);
  return ok(data);
};