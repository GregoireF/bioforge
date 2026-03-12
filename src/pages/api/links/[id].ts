// src/pages/api/links/[id].ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);
const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, data: d }), { headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;
  const { id } = ctx.params;
  if (!id) return err('Missing id', 400);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const allowed: any = {};
  if (typeof body.is_active  === 'boolean') allowed.is_active  = body.is_active;
  if (typeof body.title      === 'string')  allowed.title      = body.title;
  if (typeof body.expires_at === 'string')  allowed.expires_at = body.expires_at;
  if (!Object.keys(allowed).length) return err('No valid fields', 400);

  const { data, error } = await sb.from('short_links').update(allowed).eq('id', id).eq('profile_id', profile.id).select().single();
  if (error) return err(error.message, 500);
  return ok(data);
};

export const DELETE: APIRoute = async (ctx) => {
  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);
  const { profile } = auth.data;
  const { id } = ctx.params;
  if (!id) return err('Missing id', 400);

  const { error } = await sb.from('short_links').delete().eq('id', id).eq('profile_id', profile.id);
  if (error) return err(error.message, 500);
  return ok({ deleted: true });
};